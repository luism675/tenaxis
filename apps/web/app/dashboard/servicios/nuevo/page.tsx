"use client";

import { useState, useEffect, Suspense, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  clientesClient,
  type ClienteSearchResult,
  type ContratoCliente,
} from "@/lib/api/clientes-client";
import {
  completeFollowUp,
  createOrdenServicio,
  getMyFollowUpStatus,
  notifyServiceOperatorWebhook,
  type FollowUpStatusItem,
  type FollowUpStatusResponse,
} from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { ClienteSolicitanteCombobox, type ClienteSolicitanteOption } from "./cliente-solicitante-combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select-shadcn";
import {
  ArrowLeft,
  User,
  Calendar,
  CreditCard,
  Briefcase,
  Save,
  GanttChart,
  Trash2,
  Plus,
  MapPin,
  Clock,
  Contact2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { DashboardLayout } from "@/components/dashboard";
import { cn } from "@/components/ui/utils";
import { getBrowserCookie } from "@/lib/api/browser-client";
import { configClient } from "@/lib/api/config-client";
import { enterpriseClient } from "@/lib/api/enterprise-client";
import { geoClient } from "@/lib/api/geo-client";
import {
  bogotaDateTimeToUtcIso,
  bogotaDateToUtcIso,
  formatBogotaDate,
  formatBogotaTime,
  pickerDateToYmd,
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

const FOLLOW_UP_CHANNEL_OPTIONS = [
  { value: "LLAMADA", label: "Llamada" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "CORREO", label: "Correo" },
  { value: "VISITA", label: "Visita" },
];

const FOLLOW_UP_OUTCOME_OPTIONS = [
  { value: "CONTACTADO", label: "Contactado" },
  { value: "NO_CONTESTA", label: "No contesta" },
  { value: "REPROGRAMAR", label: "Reprogramar" },
  { value: "CIERRE_EXITOSO", label: "Cierre exitoso" },
  { value: "REQUIERE_ESCALACION", label: "Requiere escalación" },
];

interface ConfiguracionOperativa {
  id: string;
  direccionId?: string | null;
  direccion?: {
    id: string;
    direccion?: string;
  } | null;
  protocoloServicio?: string | null;
  observacionesFijas?: string | null;
  requiereFirmaDigital: boolean;
  requiereFotosEvidencia: boolean;
  duracionEstimada?: number | null;
  frecuenciaSugerida?: number | null;
}

interface Direccion {
  id: string;
  direccion?: string;
  nombreSede?: string | null;
  barrio?: string | null;
  municipio?: string | null;
  municipioId?: string | null;
  departmentId?: string | null;
  linkMaps?: string | null;
  piso?: string | null;
  bloque?: string | null;
  unidad?: string | null;
  tipoUbicacion?: string | null;
  clasificacionPunto?: string | null;
  horarioInicio?: string | null;
  horarioFin?: string | null;
  restriccionesAcceso?: string | null;
  nombreContacto?: string | null;
  telefonoContacto?: string | null;
  cargoContacto?: string | null;
}

interface Cliente {
  id: string;
  tipoCliente: "PERSONA" | "EMPRESA";
  nombre?: string | null;
  apellido?: string | null;
  razonSocial?: string | null;
  telefono?: string | null;
  telefono2?: string | null;
  numeroDocumento?: string | null;
  nit?: string | null;
  createdAt?: string;
  direcciones?: Direccion[];
}

interface Operador {
  id: string;
  nombre: string;
  telefono?: string;
}

interface Empresa {
  id: string;
  nombre: string;
}

interface Servicio {
  id: string;
  nombre: string;
}

const formatContractDate = (value?: string | null) => {
  if (!value) return "Sin fecha definida";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
};

const getClienteDisplayName = (cliente: ClienteSearchResult) =>
  cliente.tipoCliente === "EMPRESA"
    ? cliente.razonSocial || "Empresa sin nombre"
    : `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim() || "Cliente sin nombre";

const getClienteDocument = (cliente: ClienteSearchResult) =>
  cliente.numeroDocumento?.trim() || cliente.nit?.trim() || "";

const getClienteSearchDescription = (cliente: ClienteSearchResult) =>
  [cliente.telefono?.trim(), cliente.telefono2?.trim(), getClienteDocument(cliente)]
    .filter(Boolean)
    .join(" • ");

function NuevoServicioContent() {
  const router = useRouter();
  const { checkPermission, isLoading: isLoadingRole } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [selectedClienteData, setSelectedClienteData] = useState<ClienteSearchResult | null>(null);
  const [clienteSearchQuery, setClienteSearchQuery] = useState("");
  const [clienteSearchResults, setClienteSearchResults] = useState<ClienteSearchResult[]>([]);
  const [clienteSearchLoading, setClienteSearchLoading] = useState(false);
  const [clienteSearchError, setClienteSearchError] = useState<string | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [serviciosEmpresa, setServiciosEmpresa] = useState<Servicio[]>([]);
  const [clienteConfigs, setClienteConfigs] = useState<ConfiguracionOperativa[]>([]);
  const clienteSearchRequestRef = useRef(0);

  // Form State
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedDireccion, setSelectedDireccion] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [selectedOperador, setSelectedOperador] = useState("");
  const [direccionesCliente, setDireccionesCliente] = useState<Direccion[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Modal State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [departamentos, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [municipios, setMunicipalities] = useState<{id: string, name: string, departmentId: string}[]>([]);

  // New Address State
  const [newDir, setNewDir] = useState({
    direccion: "",
    nombreSede: "",
    barrio: "",
    departmentId: "",
    municipioId: "",
    linkMaps: "",
    piso: "",
    bloque: "",
    unidad: "",
    tipoUbicacion: "RESIDENCIAL",
    clasificacionPunto: "Cocina",
    horarioInicio: "08:00",
    horarioFin: "18:00",
    restriccionesAcceso: "",
    nombreContacto: "",
    telefonoContacto: "",
    cargoContacto: ""
  });

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
  const [breakdown, setBreakdown] = useState<Array<{ metodo: string; monto: string; banco?: string; referencia?: string }>>([
    { metodo: "EFECTIVO", monto: "" }
  ]);
  const [tipoFacturacion, setTipoFacturacion] = useState("");
  const [contratoActivo, setContratoActivo] = useState<ContratoCliente | null>(null);
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [estadoServicio, setEstadoServicio] = useState("NUEVO");

  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatusResponse | null>(null);
  const [checkingFollowUps, setCheckingFollowUps] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpStatusItem | null>(null);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    contactedAt: "",
    channel: "LLAMADA",
    outcome: "CONTACTADO",
    resolution: "ACEPTADO" as "ACEPTADO" | "RECHAZADO",
    notes: "",
    nextActionAt: "",
  });
  const isGarantia = tipoVisita === GARANTIA_VISIT_TYPE;

  useEffect(() => {
    if (!isLoadingRole && !checkPermission("SERVICE_CREATE")) {
      router.replace("/dashboard/servicios");
    }
  }, [isLoadingRole, checkPermission, router]);

  // Persistimos solo contexto operativo no sensible para evitar exponer o rehidratar datos contables en la URL.
  const syncToUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCliente) params.set("cliente", selectedCliente);
    if (selectedDireccion) params.set("direccion", selectedDireccion);
    if (selectedEmpresa) params.set("empresa", selectedEmpresa);
    if (selectedOperador) params.set("operador", selectedOperador);
    if (serviciosSeleccionados.length > 0) params.set("servicios", serviciosSeleccionados.join(','));
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
    selectedCliente, selectedDireccion, selectedEmpresa, selectedOperador,
    serviciosSeleccionados, tipoVisita, nivelInfestacion, urgencia, fechaVisita,
    horaInicio, duracionMinutos, tipoFacturacion,
    frecuenciaRecomendada,
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

  const empresaSeleccionadaNombre =
    empresas.find((empresa) => empresa.id === selectedEmpresa)?.nombre ||
    selectedEmpresa;

  const resumenContratoActivo = contratoActivo
    ? [
        {
          label: "Empresa vinculada",
          value: empresaSeleccionadaNombre || "Sin empresa",
        },
        {
          label: "Vigencia",
          value: contratoActivo.fechaFin
            ? `${formatContractDate(contratoActivo.fechaInicio)} - ${formatContractDate(contratoActivo.fechaFin)}`
            : `Desde ${formatContractDate(contratoActivo.fechaInicio)}`,
        },
        {
          label: "Frecuencia operativa",
          value: contratoActivo.frecuenciaServicio
            ? `Cada ${contratoActivo.frecuenciaServicio} dias`
            : "No definida",
        },
        {
          label: "Servicios comprometidos",
          value: contratoActivo.serviciosComprometidos
            ? String(contratoActivo.serviciosComprometidos)
            : "No definidos",
        },
      ]
    : [];

  const clienteOptions = useMemo<ClienteSolicitanteOption[]>(() => {
    const hydratedResults = selectedClienteData
      ? [selectedClienteData, ...clienteSearchResults.filter((cliente) => cliente.id !== selectedClienteData.id)]
      : clienteSearchResults;

    return hydratedResults.map((cliente) => ({
      id: cliente.id,
      label: getClienteDisplayName(cliente),
      description: getClienteSearchDescription(cliente),
    }));
  }, [clienteSearchResults, selectedClienteData]);

  const selectedClienteOption = useMemo<ClienteSolicitanteOption | null>(() => {
    if (!selectedClienteData) {
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

  const applyConfigToForm = useCallback((configs: ConfiguracionOperativa[], dirId?: string) => {
    // 1. Try to find config for specific address
    // 2. Fallback to global config (direccionId is null or undefined)
    const targetConfig = configs.find(c => c.direccionId === dirId) ||
                         configs.find(c => !c.direccionId);

    if (targetConfig) {
      if (targetConfig.duracionEstimada) setDuracionMinutos(String(targetConfig.duracionEstimada));
      if (targetConfig.frecuenciaSugerida) setFrecuenciaRecomendada(targetConfig.frecuenciaSugerida);

      const notes = [];
      if (targetConfig.protocoloServicio) notes.push(`PROTOCOLO: ${targetConfig.protocoloServicio}`);
      if (targetConfig.observacionesFijas) notes.push(`OBSERVACIONES FIJAS: ${targetConfig.observacionesFijas}`);

      if (notes.length > 0) {
        setRecomendacionesObligatorias(notes.join('\n\n'));
      }
    }
  }, []);

  const handleNivelInfestacionChange = (val: string) => {
    setNivelInfestacion(val);

    if (!val) {
      setFrecuenciaRecomendada("");
      return;
    }

    let suggestedDays = 30; // Default monthly
    switch (val) {
      case "CRITICO": suggestedDays = 7; break; // Weekly
      case "ALTO": suggestedDays = 15; break; // Bi-weekly
      case "MEDIO": suggestedDays = 30; break; // Monthly
      case "BAJO": suggestedDays = 60; break; // Bi-monthly
      case "PREVENTIVO": suggestedDays = 90; break; // Quarterly
    }

    setFrecuenciaRecomendada(suggestedDays);
  };

  // Carga de métodos de pago cuando cambia la empresa seleccionada
  const fetchMetodosPago = useCallback(async (empId: string) => {
    if (!empId) return;
    try {
      await configClient.getMetodosPago(empId);
      // setMetodosPago(...) removed as it was unused
    } catch (e) {
      console.error("Error loading payment methods", e);
    }
  }, []);

  // Carga de operadores cuando cambia la empresa
  const fetchOperadores = useCallback(async (empId: string) => {
    if (!empId) return;
    try {
      const ops = await enterpriseClient.getOperators(empId);
      setOperadores(Array.isArray(ops) ? (ops as Operador[]) : []);
    } catch (e) {
      console.error("Error loading operators", e);
    }
  }, []);

  // Carga de servicios cuando cambia la empresa
  const fetchServicios = useCallback(async (empId: string) => {
    if (!empId) return;
    try {
      const svs = await configClient.getServicios(empId);
      setServiciosEmpresa(Array.isArray(svs) ? (svs as Servicio[]) : []);
    } catch (e) {
      console.error("Error loading services", e);
    }
  }, []);

  const refreshFollowUpStatus = useCallback(async (empresaId?: string) => {
    if (!empresaId || !membershipId) {
      setFollowUpStatus(null);
      return null;
    }

    setCheckingFollowUps(true);
    try {
      const status = await getMyFollowUpStatus(empresaId);
      setFollowUpStatus(status);
      return status;
    } catch (e) {
      console.error("Error loading follow-up status", e);
      return null;
    } finally {
      setCheckingFollowUps(false);
    }
  }, [membershipId]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    const loadData = async () => {
      const userData = localStorage.getItem("user");
      // Obtener empresa seleccionada actualmente en el selector de la barra lateral
      const currentEmpresaId =
        localStorage.getItem("current-enterprise-id") ||
        getBrowserCookie("x-enterprise-id");

      let uRole = null;

      if (userData && userData !== "undefined") {
        try {
          const user = JSON.parse(userData);
          uRole = user.role;
          setUserRole(uRole);
          setMembershipId(user.membershipId || null);
        } catch (_e) { /* ignore */ }
      }

      try {
        const [emps, deps, muns] = await Promise.all([
          enterpriseClient.getAll(),
          geoClient.getDepartments(),
          geoClient.getMunicipalities(),
        ]);

        setDepartments(deps);
        setMunicipalities(muns);

        // Enterprises returns { items: [], count: X, maxEmpresas: Y }
        const loadedEmpresas = (
          Array.isArray(emps) ? emps : (emps as { items: Empresa[] })?.items || (emps as { data: Empresa[] })?.data || []
        ) as Empresa[];

        setEmpresas(loadedEmpresas);

        // --- URL OVERRIDE LOGIC ---
        const urlParams = new URLSearchParams(window.location.search);

        // 1. Empresa Pre-selection
        let targetEmpresaId = urlParams.get("empresa") || "";

        // If not in URL, try from cookie/localStorage
        if (!targetEmpresaId && currentEmpresaId && loadedEmpresas.some(e => e.id === currentEmpresaId)) {
          targetEmpresaId = currentEmpresaId;
        }

        // If still no target, or target not in list, pick the first one
        if (!targetEmpresaId || !loadedEmpresas.some(e => e.id === targetEmpresaId)) {
          if (loadedEmpresas.length > 0) {
            targetEmpresaId = loadedEmpresas[0].id;
          }
        }

        if (targetEmpresaId) {
          setSelectedEmpresa(targetEmpresaId);
          fetchMetodosPago(targetEmpresaId);
          fetchOperadores(targetEmpresaId);
          fetchServicios(targetEmpresaId);
          void refreshFollowUpStatus(targetEmpresaId);
        }

        // 2. Cliente and dependent data
        const urlClientId = urlParams.get("cliente");
        if (urlClientId) {
          setSelectedCliente(urlClientId);

          const [configsResult, cliente] = await Promise.all([
            configClient.getClienteOperativa(urlClientId),
            clientesClient.getById(urlClientId),
          ]);
          const configs = Array.isArray(configsResult) ? (configsResult as ConfiguracionOperativa[]) : [];
          setClienteConfigs(configs);
          if (cliente) {
            setSelectedClienteData(cliente);
          }

          const urlDirId = urlParams.get("direccion");
          const dirs = cliente?.direcciones || [];
          setDireccionesCliente(dirs);

          if (urlDirId) {
            setSelectedDireccion(urlDirId);
            applyConfigToForm(configs, urlDirId);
          } else if (dirs.length > 0) {
            setSelectedDireccion(dirs[0].id);
            applyConfigToForm(configs, dirs[0].id);
          }
        }

        // 3. Other fields
        if (urlParams.get("operador")) setSelectedOperador(urlParams.get("operador")!);
        const urlServicios = urlParams.get("servicios") || urlParams.get("servicio");
        if (urlServicios) setServiciosSeleccionados(urlServicios.split(','));
        if (urlParams.get("tipoVisita")) setTipoVisita(normalizeVisitTypeValue(urlParams.get("tipoVisita")));
        if (urlParams.get("nivel")) setNivelInfestacion(urlParams.get("nivel")!);
        if (urlParams.get("urgencia")) setUrgencia(urlParams.get("urgencia")!);
        if (urlParams.get("fecha")) setFechaVisita(urlParams.get("fecha")!);
        if (urlParams.get("hora")) setHoraInicio(urlParams.get("hora")!);
        if (urlParams.get("duracion")) setDuracionMinutos(urlParams.get("duracion")!);
        if (urlParams.get("facturacion")) setTipoFacturacion(urlParams.get("facturacion")!);
        if (urlParams.get("frecuencia")) setFrecuenciaRecomendada(Number(urlParams.get("frecuencia")));
      } catch (e) {
        console.error("Error loading initial data", e);
        toast.error("Error al cargar datos básicos");
      }
    };

    loadData();

    return () => { document.body.style.overflow = originalStyle; };
  }, [fetchMetodosPago, fetchOperadores, fetchServicios, refreshFollowUpStatus, applyConfigToForm]);

  const loadContratoActivo = useCallback(async (clientId: string, empresaId: string) => {
    if (!clientId || !empresaId) {
      setContratoActivo(null);
      return;
    }

    setLoadingContrato(true);
    try {
      const contrato = await clientesClient.getActiveContrato(
        clientId,
        empresaId,
      );

      if (contrato) {
        setContratoActivo(contrato as ContratoCliente);
        if (contrato.tipoFacturacion) {
          setTipoFacturacion(contrato.tipoFacturacion);
        } else {
          setTipoFacturacion("UNICO");
        }
      } else {
        setContratoActivo(null);
        setTipoFacturacion("UNICO");
      }
    } catch (error) {
      console.error("Error loading active contract", error);
      setContratoActivo(null);
      setTipoFacturacion("UNICO");
    } finally {
      setLoadingContrato(false);
    }
  }, []);

  const handleEmpresaChange = (val: string) => {
    setSelectedEmpresa(val);
    fetchMetodosPago(val);
    fetchOperadores(val);
    fetchServicios(val);
    void refreshFollowUpStatus(val);
    setServiciosSeleccionados([]);

    if (selectedCliente) {
      void loadContratoActivo(selectedCliente, val);
    }
  };

  const handleClienteChange = async (option: ClienteSolicitanteOption | null) => {
    const clientId = option?.id ?? "";
    setSelectedCliente(clientId);
    setSelectedClienteData((current) => {
      if (!option) {
        return null;
      }

      const cachedCliente = clienteSearchResults.find((cliente) => cliente.id === option.id);
      if (cachedCliente) {
        return cachedCliente;
      }

      return current?.id === option.id
        ? current
        : {
            id: option.id,
            tipoCliente: "PERSONA",
            nombre: option.label,
          };
    });
    setClienteConfigs([]);

    if (clientId) {
      const [configsResult, cliente] = await Promise.all([
        configClient.getClienteOperativa(clientId),
        clientesClient.getById(clientId),
      ]);
      const configs = Array.isArray(configsResult) ? (configsResult as ConfiguracionOperativa[]) : [];
      const resolvedCliente = cliente ?? null;
      setClienteConfigs(configs);
      if (cliente) {
        setSelectedClienteData(cliente);
      }

      const dirs = resolvedCliente?.direcciones || [];
      setDireccionesCliente(dirs);

      let dirId = "";
      if (dirs.length > 0) {
        dirId = dirs[0].id;
        setSelectedDireccion(dirId);
      } else {
        setSelectedDireccion("");
      }

      applyConfigToForm(configs, dirId);

      if (selectedEmpresa) {
        void loadContratoActivo(clientId, selectedEmpresa);
      }
    } else {
      setDireccionesCliente([]);
      setSelectedDireccion("");
      setRecomendacionesObligatorias("");
      setDuracionMinutos("60");
      setFrecuenciaRecomendada("");
      setContratoActivo(null);
    }
  };

  const handleDireccionChange = (dirId: string) => {
    setSelectedDireccion(dirId);
    applyConfigToForm(clienteConfigs, dirId);
  };

  useEffect(() => {
    if (selectedCliente && selectedEmpresa) {
      void loadContratoActivo(selectedCliente, selectedEmpresa);
    }
  }, [selectedCliente, selectedEmpresa, loadContratoActivo]);

  const toUtcIsoFromDateTimeLocal = (value: string) => {
    const [datePart, timePart] = value.split("T");
    if (!datePart || !timePart) return "";
    return bogotaDateTimeToUtcIso(datePart, timePart);
  };

  const openFollowUpModal = (item: FollowUpStatusItem) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");

    setSelectedFollowUp(item);
    setFollowUpForm({
      contactedAt: `${yyyy}-${mm}-${dd}T${hh}:${min}`,
      channel: "LLAMADA",
      outcome: "CONTACTADO",
      resolution: "ACEPTADO",
      notes: "",
      nextActionAt: "",
    });
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
      await completeFollowUp(selectedFollowUp.id, {
        contactedAt: toUtcIsoFromDateTimeLocal(followUpForm.contactedAt),
        channel: followUpForm.channel,
        outcome: followUpForm.outcome,
        resolution: followUpForm.resolution,
        notes: followUpForm.notes.trim(),
        nextActionAt: followUpForm.nextActionAt
          ? toUtcIsoFromDateTimeLocal(followUpForm.nextActionAt)
          : undefined,
      });

      toast.success("Seguimiento registrado correctamente");

      const updatedStatus = await refreshFollowUpStatus(selectedEmpresa);
      if (!updatedStatus?.blocked) {
        setIsFollowUpModalOpen(false);
      } else if (updatedStatus.overdueItems.length > 0) {
        const nextPending = updatedStatus.overdueItems.find(
          (item) => item.id !== selectedFollowUp.id,
        );
        setSelectedFollowUp(nextPending || null);
        if (nextPending) {
            setFollowUpForm((current) => ({
              ...current,
              notes: "",
              resolution: "ACEPTADO",
              nextActionAt: "",
            }));
        }
      }
    } catch (error) {
      console.error("Error completing follow-up", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudo registrar el seguimiento",
      );
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleAddAddress = async () => {
    if (!selectedCliente) return;
    if (!newDir.direccion || !newDir.municipioId) {
      toast.error("Dirección y municipio son obligatorios");
      return;
    }

    setLoadingAddress(true);
    try {
      const client = await clientesClient.getById(selectedCliente) as Cliente | null;
      if (!client) throw new Error("Cliente no encontrado");

      // CLEANUP: We must remove relations and system-managed fields that Prisma rejects in a 'create' nested block
      const existingDirs = (client.direcciones || []).map((d: Direccion) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, municipio, municipioId, departmentId, linkMaps, ...rest } = d;
        return {
          ...rest,
          municipioId: municipioId || null,
          departmentId: departmentId || null,
          linkMaps: linkMaps || null
        };
      });

      // Explicitly construct the new address to avoid any unexpected fields from state
      const newAddress = {
        direccion: newDir.direccion,
        nombreSede: newDir.nombreSede || null,
        barrio: newDir.barrio || null,
        departmentId: newDir.departmentId || null,
        municipioId: newDir.municipioId || null,
        linkMaps: newDir.linkMaps || null,
        piso: newDir.piso || null,
        bloque: newDir.bloque || null,
        unidad: newDir.unidad || null,
        tipoUbicacion: newDir.tipoUbicacion || null,
        clasificacionPunto: newDir.clasificacionPunto || null,
        horarioInicio: newDir.horarioInicio || null,
        horarioFin: newDir.horarioFin || null,
        restricciones: newDir.restriccionesAcceso || null,
        nombreContacto: newDir.nombreContacto || null,
        telefonoContacto: newDir.telefonoContacto || null,
        cargoContacto: newDir.cargoContacto || null,
        activa: true,
        validadoPorSistema: false,
      };

      const updatedDirs = [...existingDirs, newAddress];

      console.log("[AddressModal] Sending updated addresses:", updatedDirs);

      await clientesClient.update(selectedCliente, {
        direcciones: updatedDirs as unknown as Direccion[]
      });

      toast.success("Dirección añadida correctamente");
      setIsAddressModalOpen(false);
      // Refresh client data
      const updatedClient = await clientesClient.getById(selectedCliente) as Cliente | null;
      if (updatedClient) {
        const dirs = updatedClient.direcciones || [];
        setDireccionesCliente(dirs);
        if (dirs.length > 0) {
          const latestDir = dirs[dirs.length - 1];
          setSelectedDireccion(latestDir.id);
          applyConfigToForm(clienteConfigs, latestDir.id);
        }

        setSelectedClienteData(updatedClient as unknown as ClienteSearchResult);
      }
      // Reset form
      setNewDir({
        direccion: "",
        nombreSede: "",
        barrio: "",
        departmentId: "",
        municipioId: "",
        linkMaps: "",
        piso: "",
        bloque: "",
        unidad: "",
        tipoUbicacion: "RESIDENCIAL",
        clasificacionPunto: "Cocina",
        horarioInicio: "08:00",
        horarioFin: "18:00",
        restriccionesAcceso: "",
        nombreContacto: "",
        telefonoContacto: "",
        cargoContacto: ""
      });
    } catch (e) {
      console.error(e);
      toast.error("Error inesperado al añadir dirección");
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    if (
      !selectedCliente ||
      !selectedEmpresa ||
      serviciosSeleccionados.length === 0 ||
      !diagnosticoTecnico.trim()
    ) {
      toast.error("Por favor complete los campos obligatorios");
      setLoading(false);
      return;
    }

    const payload = {
      clienteId: selectedCliente,
      empresaId: selectedEmpresa,
      tecnicoId: selectedOperador || undefined,
      sinTecnico: !selectedOperador,
      direccionId: selectedDireccion || undefined,
      creadoPorId: membershipId || undefined,
      servicioId: serviciosEmpresa.find((item) => item.nombre === serviciosSeleccionados[0])?.id,
      serviciosSeleccionados,
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
      valorCotizado: valorCotizado ? Number(valorCotizado.replace(/\./g, "")) : undefined,
      desglosePago: breakdown.map(line => ({
        ...line,
        monto: parseFloat(line.monto.replace(/\./g, "")) || 0
      })),
      estadoServicio: estadoServicio || undefined,
      fechaVisita: fechaVisita ? bogotaDateToUtcIso(fechaVisita) : undefined,
      horaInicio: (fechaVisita && horaInicio) ? bogotaDateTimeToUtcIso(fechaVisita, horaInicio) : undefined,
      horaInicioReal: horaInicioReal
        ? new Date(horaInicioReal).toISOString()
        : undefined,
      horaFinReal: horaFinReal ? new Date(horaFinReal).toISOString() : undefined,
      duracionMinutos: Number(duracionMinutos),
    };

    // Bloqueo por seguimientos desactivado temporalmente:
    // antes impedía crear/asignar servicios si el usuario no tenía llamadas de seguimiento registradas.
    // Se preserva la lógica anterior comentada para poder recuperarla si se vuelve a exigir este control.
    // const latestFollowUpStatus = await refreshFollowUpStatus(selectedEmpresa);
    // if (latestFollowUpStatus?.blocked) {
    //   toast.error("Tienes seguimientos vencidos pendientes. Completa las llamadas antes de asignar más servicios.");
    //   setLoading(false);
    //   return;
    // }

    const loadingToastId = toast.loading("Generando orden de servicio...");

    try {
      const orderData = await createOrdenServicio(payload, { timeoutMs: 25_000 });

      if (orderData.picoPlacaWarning) {
        toast.warning(orderData.picoPlacaWarning.message, { duration: 9000 });
      }

      const targetTecnicoId = orderData.tecnicoId ?? null;

      if (targetTecnicoId) {
        const operator = operadores.find((item) => item.id === targetTecnicoId);
        const client = selectedClienteData;
        const direccion = direccionesCliente.find((item) => item.id === selectedDireccion);

        if (operator?.telefono) {
          const utcDateTime =
            fechaVisita && horaInicio
              ? bogotaDateTimeToUtcIso(fechaVisita, horaInicio)
              : null;
          const programacion = utcDateTime
            ? `${formatBogotaDate(utcDateTime)} a las ${formatBogotaTime(
                utcDateTime,
                "es-CO",
                {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                },
              )}`
            : "Sin programación definida";
          const metodosFormatted = breakdown
            .map((item) => `${item.metodo} ($ ${item.monto})`)
            .join(", ");
          const orderId = String(orderData.id ?? "");
          const numeroOrden = orderData.numeroOrden
            ? `#${orderData.numeroOrden}`
            : orderId
              ? `#${orderId.slice(0, 8).toUpperCase()}`
              : "#SERVICIO";

          void notifyServiceOperatorWebhook({
            telefonoOperador: operator.telefono,
            numeroOrden,
            cliente: client
              ? client.tipoCliente === "EMPRESA"
                ? client.razonSocial || ""
                : `${client.nombre} ${client.apellido}`
              : "Cliente desconocido",
            servicio: serviciosSeleccionados.join(", ").toUpperCase(),
            programacion,
            tecnico: operator.nombre,
            estado: estadoServicio,
            urgencia,
            direccion: direccion?.direccion ?? "N/A",
            linkMaps: direccion?.linkMaps || "N/A",
            municipio: direccion?.municipio || "N/A",
            barrio: direccion?.barrio || "N/A",
            detalles: "Sin detalles adicionales",
            valorCotizado: `$ ${valorCotizado}`,
            metodosPago: metodosFormatted,
            observaciones: diagnosticoTecnico || "Sin diagnóstico técnico",
            idServicio: orderId,
          })
            .then((webhookRes) => {
              if (webhookRes.success) {
                toast.success("Operador notificado correctamente");
              } else {
                toast.error("No se pudo notificar al operador");
              }
            })
            .catch((error) => {
              console.error("Error triggering operator notification webhook", error);
            });
        } else {
          toast.warning("El operador asignado no tiene teléfono registrado. No se envió notificación.");
        }
      }

      toast.success("Orden de servicio generada correctamente");
      router.push("/dashboard/servicios");
    } catch (error) {
      console.error("Error creating service order", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo generar la orden. Intentá nuevamente.",
      );
    } finally {
      toast.dismiss(loadingToastId);
      setLoading(false);
    }
  };

  const isEmpresaLocked = userRole === "ASESOR";
  // Bloqueo por seguimientos desactivado temporalmente para permitir crear/asignar servicios
  // aunque no existan llamadas registradas. Lógica anterior:
  // const isCreationBlocked = Boolean(followUpStatus?.blocked);
  const isCreationBlocked = false;
  const selectedDireccionData = direccionesCliente.find((direccion) => direccion.id === selectedDireccion);
  const selectedOperatorLabel =
    operadores.find((operador) => operador.id === selectedOperador)?.nombre || "Por asignar";
  const breakdownTotal = breakdown.reduce(
    (sum, line) => sum + (parseFloat(line.monto.replace(/\./g, "")) || 0),
    0,
  );
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

  const SectionHeader = ({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) => (
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

  if (isLoadingRole) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Validando permisos...
      </div>
    );
  }

  if (!checkPermission("SERVICE_CREATE")) {
    return null;
  }

  return (
    <div className="h-full min-h-0 p-4 sm:p-6 lg:p-10">
      <div className="mx-auto flex h-full w-full max-w-[1500px] min-h-0 flex-col">
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", editPanelClass)}>

        {/* Header Fijo */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="h-8 w-8 shrink-0 rounded-[4px] border-border bg-background text-muted-foreground hover:bg-muted">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="break-words text-[15px] font-medium tracking-tight text-foreground">Nueva orden de servicio</h1>
                <span className="rounded-[4px] border border-[#01ADFB]/20 bg-[#01ADFB]/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#01ADFB]">
                  {estadoServicio || "NUEVO"}
                </span>
              </div>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">Creación operativa y financiera del servicio.</p>
            </div>
          </div>
        </div>

        {/* Contenido Scrollable */}
        <div className="flex-1 overflow-y-auto bg-background p-5 custom-scrollbar lg:p-6">
          <form id="servicio-form" onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
            {followUpStatus && (isCreationBlocked || followUpStatus.activeOverride) ? (
              <section
                className={cn(
                  "rounded-2xl border px-5 py-4",
                  isCreationBlocked
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-emerald-200 bg-emerald-50 text-emerald-950",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 rounded-full p-2",
                      isCreationBlocked ? "bg-amber-100" : "bg-emerald-100",
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.08em]">
                        {isCreationBlocked
                          ? "Asignación bloqueada por seguimientos pendientes"
                          : "Desbloqueo temporal activo"}
                      </p>
                      <p className="text-sm">
                        {isCreationBlocked
                          ? `Tienes ${followUpStatus.overdueCount} seguimiento(s) vencido(s) de servicios creados por ti.`
                          : "Puedes seguir asignando servicios mientras esté vigente el permiso temporal."}
                      </p>
                    </div>

                    {followUpStatus.activeOverride ? (
                      <p className="text-xs font-semibold">
                        Vigente hasta {formatBogotaDate(followUpStatus.activeOverride.endsAt)} {formatBogotaTime(followUpStatus.activeOverride.endsAt)}
                        {followUpStatus.activeOverride.reason ? ` • ${followUpStatus.activeOverride.reason}` : ""}
                      </p>
                    ) : null}

                    {followUpStatus.overdueItems.length > 0 ? (
                      <div className="space-y-2">
                        {followUpStatus.overdueItems.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-current/10 bg-white/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-medium">
                              {item.cliente} • {item.servicio} • {formatBogotaDate(item.dueAt)}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openFollowUpModal(item)}
                              className="h-9 rounded-xl border-current/20 bg-white/70 text-[10px] font-black uppercase tracking-[0.14em]"
                            >
                              Registrar seguimiento
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {isCreationBlocked ? (
                      <div className="flex flex-wrap gap-3 pt-1">
                        <Button
                          type="button"
                          onClick={() => {
                            if (followUpStatus.overdueItems[0]) {
                              openFollowUpModal(followUpStatus.overdueItems[0]);
                            }
                          }}
                          className="h-10 rounded-xl bg-amber-600 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-amber-700"
                        >
                          Resolver bloqueo ahora
                        </Button>
                        <Link href="/dashboard/servicios?tab=seguimientos">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl border-amber-300 bg-white/70 px-4 text-[10px] font-black uppercase tracking-[0.16em]"
                          >
                            Ver tab de seguimientos
                          </Button>
                        </Link>
                        <p className="self-center text-xs font-medium">
                          Registra la llamada y el resultado para volver a asignar servicios.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

              {/* SECCIÓN 1: IDENTIFICACIÓN DEL CLIENTE */}
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
                      {selectedClienteOption?.description || "Cliente pendiente"}
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <Button variant="ghost" className="h-7 w-fit px-0 text-[10px] font-medium text-[#01ADFB] hover:bg-transparent hover:text-[#0197dc]" onClick={() => router.push('/dashboard/clientes/nuevo')}>
                      + Registrar nuevo cliente
                    </Button>
                  </div>
                </div>

                <div aria-hidden="true" className="hidden bg-border md:block" />

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Dirección <span className="text-red-500">*</span></Label>
                  <Combobox
                    options={[
                      { value: "", label: selectedCliente ? "Seleccionar sede disponible..." : "Primero seleccione un cliente" },
                      ...(Array.isArray(direccionesCliente) ? direccionesCliente : []).map(d => ({
                        value: d.id,
                        label: `${d.direccion} - ${d.nombreSede || d.barrio}${d.municipio ? ` (${d.municipio})` : ""}`
                      }))
                    ]}
                    value={selectedDireccion}
                    onChange={handleDireccionChange}
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
                  {selectedCliente && (
                    <div className="flex justify-start">
                      <Button
                        variant="ghost"
                        type="button"
                        className="h-7 w-fit px-0 text-[10px] font-medium text-[#01ADFB] hover:bg-transparent hover:text-[#0197dc]"
                        onClick={() => setIsAddressModalOpen(true)}
                      >
                        + Añadir nueva dirección
                      </Button>
                    </div>
                  )}
                  {!selectedCliente && (
                    <p className="text-[10px] font-medium text-amber-700">Debe vincular un cliente para cargar sedes.</p>
                  )}
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: ESPECIFICACIONES TÉCNICAS */}
            <section className={editSectionClass}>
              <SectionHeader icon={<Briefcase className="h-4 w-4" />} title="Especificaciones técnicas" subtitle="Configurá alcance, prioridad y criterios técnicos de la orden." />

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Empresa asociada <span className="text-red-500">*</span></Label>
                  <Combobox
                    options={[
                      { value: "", label: "Seleccionar empresa..." },
                      ...(Array.isArray(empresas) ? empresas : []).map(e => ({ value: e.id, label: e.nombre }))
                    ]}
                    value={selectedEmpresa}
                    onChange={handleEmpresaChange}
                    disabled={isEmpresaLocked}
                    placeholder="Empresa..."
                    hideSearch
                    triggerClassName={editComboboxTriggerClass}
                    contentClassName={editComboboxContentClass}
                  />
                  {isEmpresaLocked && (
                    <p className="text-[10px] font-medium text-[#01ADFB]">Pre-asignada por coordinación.</p>
                  )}
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Estado del servicio <span className="text-red-500">*</span></Label>
                  <Combobox
                    options={ESTADOS_ORDEN.map(est => ({ value: est.value, label: est.label }))}
                    value={estadoServicio}
                    onChange={setEstadoServicio}
                    placeholder="Estado..."
                    hideSearch
                    triggerClassName={editComboboxTriggerClass}
                    contentClassName={editComboboxContentClass}
                  />
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
                    value={""}
                    onChange={(val) => {
                      if (val && !serviciosSeleccionados.includes(val)) {
                        setServiciosSeleccionados([...serviciosSeleccionados, val]);
                      }
                    }}
                    disabled={!selectedEmpresa}
                    placeholder="Buscar servicio..."
                    triggerClassName={editComboboxTriggerClass}
                    contentClassName={editComboboxContentClass}
                  />
                  {serviciosSeleccionados.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {serviciosSeleccionados.map((srv, idx) => (
                        <div key={idx} className="inline-flex max-w-full items-center gap-1 rounded border border-[#01ADFB]/20 bg-[#01ADFB]/10 px-2 py-1 text-[10px] font-medium text-[#01ADFB]">
                          <span className="min-w-0 break-words">{srv}</span>
                          <button
                            type="button"
                            onClick={() => setServiciosSeleccionados(serviciosSeleccionados.filter(s => s !== srv))}
                            className="shrink-0 text-[#01ADFB] hover:text-red-500 focus:outline-none"
                            aria-label={`Quitar ${srv}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!selectedEmpresa && (
                    <p className="text-[10px] font-medium text-amber-700">Seleccione una empresa para cargar servicios.</p>
                  )}
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Tipo de visita <span className="text-red-500">*</span></Label>
                  <Combobox
                    options={[
                      { value: "", label: "Seleccionar visita..." },
                      ...TIPOS_VISITA.map(t => ({ value: t.value, label: t.label }))
                    ]}
                    value={tipoVisita}
                    onChange={setTipoVisita}
                    placeholder="Visita..."
                    hideSearch
                    triggerClassName={editComboboxTriggerClass}
                    contentClassName={editComboboxContentClass}
                  />
                  {isGarantia ? (
                    <p className="text-[10px] font-medium text-amber-700">
                      La garantía se valida con el historial del cliente y se liquida en 0.
                    </p>
                  ) : null}
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Nivel de infestación</Label>
                  <Combobox
                    options={[
                      { value: "", label: "Seleccionar nivel..." },
                      ...NIVELES_INFESTACION.map(n => ({ value: n.value, label: n.label }))
                    ]}
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
                  <Input
                    type="number"
                    value={frecuenciaRecomendada}
                    onChange={(e) => setFrecuenciaRecomendada(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Días"
                    className={editInputClass}
                  />
                  {nivelInfestacion && (
                     <p className="text-[10px] text-muted-foreground">Sugerido según nivel de infestación.</p>
                  )}
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Urgencia</Label>
                  <Combobox
                    options={[
                      { value: "", label: "Seleccionar urgencia..." },
                      ...URGENCIAS.map(u => ({ value: u.value, label: u.label }))
                    ]}
                    value={urgencia}
                    onChange={setUrgencia}
                    placeholder="Urgencia..."
                    hideSearch
                    triggerClassName={editComboboxTriggerClass}
                    contentClassName={editComboboxContentClass}
                  />
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>
                    Hubo Sellamiento
                  </Label>
                  <Combobox
                    options={[
                      { value: "", label: "Seleccionar..." },
                      { value: "true", label: "Sí" },
                      { value: "false", label: "No" },
                    ]}
                    value={huboSellamiento}
                    onChange={setHuboSellamiento}
                    placeholder="Sellamiento..."
                    hideSearch
                    triggerClassName={editComboboxTriggerClass}
                    contentClassName={editComboboxContentClass}
                  />
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>
                    Recomendación estructural
                  </Label>
                  <Combobox
                    options={[
                      { value: "", label: "Seleccionar..." },
                      { value: "true", label: "Sí" },
                      { value: "false", label: "No" },
                    ]}
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
                  <textarea value={diagnosticoTecnico} onChange={(e) => setDiagnosticoTecnico(e.target.value)} className={editTextareaClass} placeholder="Describe la causa del problema, evaluación técnica y contexto encontrado..." required />
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

            {/* SECCIÓN 3: AGENDA OPERATIVA */}
            <section className={editSectionClass}>
              <SectionHeader icon={<Calendar className="h-4 w-4" />} title="Agenda operativa" subtitle="Fecha, tiempos reales y asignación técnica." />

              <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-5">
                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Fecha de ejecución <span className="text-red-500">*</span></Label>
                  <DatePicker
                    date={fechaVisita ? ymdToPickerDate(fechaVisita) : undefined}
                    onChange={(d) => setFechaVisita(pickerDateToYmd(d))}
                    className={editInputClass}
                  />
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Hora programada <span className="text-red-500">*</span></Label>
                  <TimePicker
                    value={horaInicio}
                    onChange={setHoraInicio}
                    className={editInputClass}
                  />
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>
                    Inicio real
                  </Label>
                  <Input
                    type="datetime-local"
                    value={horaInicioReal}
                    onChange={(e) => setHoraInicioReal(e.target.value)}
                    className={editInputClass}
                  />
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>
                    Fin real
                  </Label>
                  <Input
                    type="datetime-local"
                    value={horaFinReal}
                    onChange={(e) => setHoraFinReal(e.target.value)}
                    className={editInputClass}
                  />
                </div>

                <div className={fieldGroupClass}>
                  <Label className={editLabelClass}>Duración <span className="text-red-500">*</span></Label>
                  <Combobox
                    options={[
                      { value: "60", label: "60 Minutos" },
                      { value: "90", label: "90 Minutos" },
                      { value: "120", label: "120 Minutos" },
                      { value: "180", label: "180 Minutos" }
                    ]}
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
                    options={[
                      { value: "", label: "Por asignar" },
                      ...(Array.isArray(operadores) ? operadores : []).map(o => ({ value: o.id, label: o.nombre }))
                    ]}
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

            {/* SECCIÓN 4: CONDICIONES DE PAGO */}
            <aside className="min-w-0 space-y-5 lg:sticky lg:top-0 lg:max-h-[calc(100vh-12rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:border-border lg:pl-5 lg:pr-1 custom-scrollbar">
            <section className={editSectionClass}>
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
                        }}
                        placeholder="0"
                        required
                        disabled={isGarantia}
                        className={cn(editInputClass, "pl-7 tabular-nums")}
                      />
                    </div>
                    {isGarantia ? (
                      <p className="text-[10px] font-medium text-emerald-700">
                        La garantía se conserva con tarifa 0 y sin cobro manual.
                      </p>
                    ) : null}
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Tipo de facturación</Label>
                    {contratoActivo ? (
                      <div className="space-y-3 rounded-[4px] border border-emerald-200 bg-emerald-50 px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                          Segun contrato activo
                        </p>
                        <p className="text-sm font-bold text-zinc-900">
                          {TIPOS_FACTURACION.find((item) => item.value === tipoFacturacion)?.label || tipoFacturacion}
                        </p>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {resumenContratoActivo.map((item) => (
                            <div
                              key={item.label}
                              className="rounded-[4px] border border-emerald-100 bg-white/70 px-3 py-2"
                            >
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                {item.label}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-zinc-900">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                        {contratoActivo.observaciones ? (
                          <div className="rounded-xl border border-emerald-100 bg-white/70 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                              Observaciones comerciales
                            </p>
                            <p className="mt-1 text-sm text-zinc-700">
                              {contratoActivo.observaciones}
                            </p>
                          </div>
                        ) : null}
                        <p className="text-xs text-zinc-600">
                          Los nuevos servicios conservan este esquema desde el contrato del cliente.
                        </p>
                        {isGarantia ? (
                          <p className="text-xs font-semibold text-amber-700">
                            Esta orden es garantía, así que la facturación queda en 0.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <Combobox
                        options={[
                          { value: "", label: "Seleccionar facturación..." },
                          ...TIPOS_FACTURACION.map(m => ({ value: m.value, label: m.label }))
                        ]}
                        value={tipoFacturacion}
                        onChange={setTipoFacturacion}
                        placeholder={loadingContrato ? "Consultando contrato..." : "Facturación..."}
                        hideSearch
                        triggerClassName={editComboboxTriggerClass}
                        contentClassName={editComboboxContentClass}
                      />
                    )}
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Esto define una condición comercial estimada. No confirma pago real; la transferencia se confirma luego con evidencia.
                </p>
            </section>

                <section className={editSectionClass}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className={editLabelClass}>Desglose de cobro</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Distribuí el valor por método de pago.</p>
                    </div>
                    <Button type="button" variant="outline" className={editGhostButtonClass} onClick={() => setBreakdown([...breakdown, { metodo: "EFECTIVO", monto: "" }])} disabled={isGarantia}>
                      <Plus className="h-3.5 w-3.5" /> Añadir
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {breakdown.map((line, index) => (
                      <div key={index} className="relative border-l border-border pl-3">
                        {breakdown.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBreakdown(breakdown.filter((_, i) => i !== index))}
                            className="absolute right-0 top-0 text-muted-foreground hover:text-red-500"
                            aria-label={`Quitar método ${index + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className={fieldGroupClass}>
                            <Label className={editLabelClass}>Método</Label>
                            <Combobox
                              options={METODOS_PAGO_BASE.map(m => ({ value: m.value, label: m.label }))}
                              value={line.metodo}
                              disabled={isGarantia}
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
                              disabled={isGarantia}
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

                        {line.metodo === "TRANSFERENCIA" && (
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className={fieldGroupClass}>
                              <Label className={editLabelClass}>Banco / entidad</Label>
                                <Input
                                  value={line.banco || ""}
                                  disabled={isGarantia}
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
                                  disabled={isGarantia}
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
                        )}
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

        {/* Footer Fijo */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            <GanttChart className="h-4 w-4 shrink-0 text-[#01ADFB]" />
            <p className="break-words">Revisá la orden antes de generarla.</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => router.back()} className={editGhostButtonClass}>Descartar</Button>
            <Button
              type="submit"
              form="servicio-form"
              disabled={loading || checkingFollowUps || isCreationBlocked}
              className={editPrimaryButtonClass}
            >
              {loading || checkingFollowUps ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save className="h-3.5 w-3.5" />}
              <span>
                {isCreationBlocked ? "Seguimientos pendientes" : "Generar y Asignar"}
              </span>
            </Button>
          </div>
        </div>

        {/* MODAL PARA AÑADIR DIRECCIÓN */}
        <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-azul-1" />
                Nueva Dirección / Sede
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-5 py-4">
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Dirección <span className="text-red-500">*</span></Label>
                <Input
                  value={newDir.direccion}
                  onChange={(e) => setNewDir({...newDir, direccion: e.target.value})}
                  placeholder="Ej: Calle 123 # 45-67"
                  className="h-9 text-sm border-zinc-200 rounded-lg focus:border-azul-1 focus:ring-0"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Nombre de Sede / Referencia</Label>
                <Input
                  value={newDir.nombreSede}
                  onChange={(e) => setNewDir({...newDir, nombreSede: e.target.value})}
                  placeholder="Ej: Sede Principal, Casa, Local 1"
                  className="h-9 text-sm border-zinc-200 rounded-lg focus:border-azul-1 focus:ring-0"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Departamento <span className="text-red-500">*</span></Label>
                <Select
                  value={newDir.departmentId}
                  onValueChange={(val) => setNewDir({...newDir, departmentId: val, municipioId: ""})}
                >
                  <SelectTrigger className="h-9 text-sm border-zinc-200 rounded-lg">
                    <SelectValue placeholder="Departamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Municipio <span className="text-red-500">*</span></Label>
                <Select
                  value={newDir.municipioId}
                  onValueChange={(val) => setNewDir({...newDir, municipioId: val})}
                  disabled={!newDir.departmentId}
                >
                  <SelectTrigger className="h-9 text-sm border-zinc-200 rounded-lg">
                    <SelectValue placeholder="Municipio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {municipios
                      .filter(m => m.departmentId === newDir.departmentId)
                      .map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Barrio</Label>
                <Input
                  value={newDir.barrio}
                  onChange={(e) => setNewDir({...newDir, barrio: e.target.value})}
                  placeholder="Nombre del barrio"
                  className="h-9 text-sm border-zinc-200 rounded-lg focus:border-azul-1 focus:ring-0"
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Link Google Maps</Label>
                <Input
                  value={newDir.linkMaps}
                  onChange={(e) => setNewDir({...newDir, linkMaps: e.target.value})}
                  placeholder="https://maps.app.goo.gl/..."
                  className="h-9 text-sm border-zinc-200 rounded-lg focus:border-azul-1 focus:ring-0"
                />
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 md:col-span-6 my-1 pt-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
                  <Contact2 className="h-3.5 w-3.5" /> Datos de Contacto en Sitio
                </h3>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Nombre Contacto</Label>
                <Input
                  value={newDir.nombreContacto}
                  onChange={(e) => setNewDir({...newDir, nombreContacto: e.target.value})}
                  placeholder="Persona que recibe el servicio"
                  className="h-9 text-sm border-zinc-200 rounded-lg focus:border-azul-1 focus:ring-0"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Teléfono Contacto</Label>
                <Input
                  value={newDir.telefonoContacto}
                  onChange={(e) => setNewDir({...newDir, telefonoContacto: e.target.value})}
                  placeholder="Teléfono móvil o fijo"
                  className="h-9 text-sm border-zinc-200 rounded-lg focus:border-azul-1 focus:ring-0"
                />
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 md:col-span-6 my-1 pt-4">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Horarios y Restricciones
                </h3>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Horario Inicio</Label>
                <TimePicker
                  value={newDir.horarioInicio}
                  onChange={(val) => setNewDir({...newDir, horarioInicio: val})}
                  className="h-9 !rounded-lg !py-0 !px-3"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Horario Fin</Label>
                <TimePicker
                  value={newDir.horarioFin}
                  onChange={(val) => setNewDir({...newDir, horarioFin: val})}
                  className="h-9 !rounded-lg !py-0 !px-3"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase text-zinc-400">Restricciones de Acceso</Label>
                <Input
                  value={newDir.restriccionesAcceso}
                  onChange={(e) => setNewDir({...newDir, restriccionesAcceso: e.target.value})}
                  placeholder="Ej: Solo ingreso con ARL..."
                  className="h-9 text-sm border-zinc-200 rounded-lg focus:border-azul-1 focus:ring-0"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
              <Button variant="ghost" size="sm" onClick={() => setIsAddressModalOpen(false)} disabled={loadingAddress}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleAddAddress}
                disabled={loadingAddress}
                className="bg-azul-1 hover:bg-blue-700 text-white min-w-[140px]"
              >
                {loadingAddress ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : "Guardar Dirección"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isFollowUpModalOpen}
          onOpenChange={(open) => {
            if (!savingFollowUp) {
              setIsFollowUpModalOpen(open);
            }
          }}
        >
          <DialogContent className="max-w-2xl border-zinc-200 bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-[0.08em] text-zinc-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Validar seguimiento
              </DialogTitle>
            </DialogHeader>

            {selectedFollowUp ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                    Seguimiento pendiente
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-bold uppercase text-zinc-900">
                      {selectedFollowUp.cliente}
                    </p>
                    <p className="text-sm text-zinc-700">{selectedFollowUp.servicio}</p>
                    <p className="text-xs font-medium text-zinc-500">
                      Vencido desde {formatBogotaDate(selectedFollowUp.dueAt)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Fecha y hora de contacto
                    </Label>
                    <Input
                      type="datetime-local"
                      value={followUpForm.contactedAt}
                      onChange={(e) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          contactedAt: e.target.value,
                        }))
                      }
                      className="h-11 rounded-xl border-zinc-200 font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Canal
                    </Label>
                    <Select
                      value={followUpForm.channel}
                      onValueChange={(value) =>
                        setFollowUpForm((current) => ({ ...current, channel: value }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl border-zinc-200">
                        <SelectValue placeholder="Selecciona un canal" />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_CHANNEL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Resultado
                    </Label>
                    <Select
                      value={followUpForm.outcome}
                      onValueChange={(value) =>
                        setFollowUpForm((current) => ({ ...current, outcome: value }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl border-zinc-200">
                        <SelectValue placeholder="Selecciona un resultado" />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_OUTCOME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Decisión del cliente
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={followUpForm.resolution === "ACEPTADO" ? "default" : "outline"}
                        onClick={() => setFollowUpForm((current) => ({ ...current, resolution: "ACEPTADO" }))}
                        className="h-11 rounded-xl text-[10px] font-black uppercase tracking-[0.16em]"
                      >
                        Aceptado
                      </Button>
                      <Button
                        type="button"
                        variant={followUpForm.resolution === "RECHAZADO" ? "destructive" : "outline"}
                        onClick={() => setFollowUpForm((current) => ({ ...current, resolution: "RECHAZADO" }))}
                        className="h-11 rounded-xl text-[10px] font-black uppercase tracking-[0.16em]"
                      >
                        Rechazado
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Notas del seguimiento
                    </Label>
                    <textarea
                      value={followUpForm.notes}
                      onChange={(e) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Ej: Se llamó al cliente, confirmó satisfacción y no requiere nueva visita."
                      className="min-h-[120px] w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 outline-none transition focus:border-azul-1"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Próxima acción opcional
                    </Label>
                    <Input
                      type="datetime-local"
                      value={followUpForm.nextActionAt}
                      onChange={(e) =>
                        setFollowUpForm((current) => ({
                          ...current,
                          nextActionAt: e.target.value,
                        }))
                      }
                      className="h-11 rounded-xl border-zinc-200 font-medium"
                    />
                    <p className="text-xs text-zinc-500">
                      Si dejas una próxima acción, el sistema crea un seguimiento adicional.
                    </p>
                  </div>
                </div>

                <DialogFooter className="gap-3 border-t border-zinc-100 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFollowUpModalOpen(false)}
                    disabled={savingFollowUp}
                    className="h-11 rounded-xl border-zinc-200 px-5 text-[10px] font-black uppercase tracking-[0.16em]"
                  >
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCompleteFollowUp}
                    disabled={savingFollowUp}
                    className="h-11 rounded-xl bg-emerald-600 px-5 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-emerald-700"
                  >
                    {savingFollowUp ? "Guardando..." : "Guardar seguimiento"}
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </div>
  );
}

export default function NuevoServicioPage() {
  return (
    <DashboardLayout overflowHidden>
      <Suspense fallback={<div className="flex h-[80vh] items-center justify-center text-sm text-zinc-500 animate-pulse font-bold uppercase tracking-widest">Iniciando protocolo de registro...</div>}>
        <NuevoServicioContent />
      </Suspense>
    </DashboardLayout>
  );
}
