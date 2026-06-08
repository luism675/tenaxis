"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  clientesClient,
  type ContratoClientePayload as ContratoClienteDTO,
} from "@/lib/api/clientes-client";
import { type ConfigItem } from "@/lib/api/config-client";
import { configClient } from "@/lib/api/config-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select-shadcn";
import { TimePicker } from "@/components/ui/time-picker";
import {
  ArrowLeft,
  Save,
  MapPin,
  Plus,
  Trash2,
  Clock,
  Contact2,
  CheckCircle2,
  Building2,
  UserCircle2,
  Target,
  Zap,
  CalendarClock,
  Search,
  AlertCircle,
  GanttChart,
  Lightbulb
} from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { DashboardLayout } from "@/components/dashboard";
import { getBrowserCookie } from "@/lib/api/browser-client";
import { enterpriseClient, type Enterprise } from "@/lib/api/enterprise-client";
import { geoClient } from "@/lib/api/geo-client";
import { getBrowserScopedEnterpriseId } from "@/lib/browser-access-scope";

type ClienteDTO = Record<string, unknown>;

// --- Constantes Estratégicas ---
const ORIGENES_CLIENTE = ["Google Ads", "Referido", "Orgánico", "Recurrente", "Campaña", "WhatsApp directo"];
const TIPOS_DOCUMENTO = ["Cédula de Ciudadanía", "Cédula de Extranjería", "Pasaporte", "Permiso Especial", "NIT"];
const CLASIFICACIONES_PUNTO = ["Cocina", "Área almacenamiento", "Zona residuos", "Zona carga", "Zona comedor", "Oficina administrativa"];
const TIPOS_FACTURACION_CONTRATO = [
  { value: "CONTRATO_MENSUAL", label: "Cobro por servicio ejecutado" },
  { value: "PLAN_TRIMESTRAL", label: "Cobro trimestral acumulado" },
  { value: "PLAN_SEMESTRAL", label: "Cobro semestral" },
  { value: "PLAN_ANUAL", label: "Cobro anual" },
] as const;
const DIRECCION_NO_CONCRETADA = "NO CONCRETADO";

function parseCoordinate(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasValidCoordinates(latitud: string, longitud: string) {
  const lat = parseCoordinate(latitud);
  const lng = parseCoordinate(longitud);

  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

interface Direccion {
  id: number;
  direccion: string;
  linkMaps: string;
  departmentId: string;
  municipioId: string;
  municipio: string;
  barrio: string;
  piso: string;
  bloque: string;
  unidad: string;
  tipoUbicacion: string;
  clasificacionPunto: string;
  horarioInicio: string;
  horarioFin: string;
  restriccionesAcceso: string;
  nombreContacto: string;
  telefonoContacto: string;
  cargoContacto: string;
  activa: boolean;
  bloqueada: boolean;
  motivoBloqueo: string;
  latitud: string;
  longitud: string;
  precisionGPS: string;
  validadoPorSistema: boolean;
}

function NuevoClienteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _fixClientId = searchParams.get("fixClientId");
  const _migrateClientId = searchParams.get("migrateClientId");

  const { checkPermission, isLoading: isLoadingRole } = useUserRole();

  useEffect(() => {
    if (!isLoadingRole && !checkPermission("CLIENT_CREATE")) {
      router.replace("/dashboard/clientes");
    }
  }, [isLoadingRole, checkPermission, router]);

  const [loading, setLoading] = useState(false);
  const submitInFlightRef = useRef(false);
  const [empresasUser, setEmpresasUser] = useState<{id: string, nombre: string}[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  const [hasActiveContract, setHasActiveContract] = useState(false);
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractServicesCommitted, setContractServicesCommitted] = useState("");
  const [contractServiceFrequency, setContractServiceFrequency] = useState("30");
  const [contractBillingType, setContractBillingType] =
    useState<ContratoClienteDTO["tipoFacturacion"]>("CONTRATO_MENSUAL");
  const [contractNotes, setContractNotes] = useState("");

  // --- Datos Dinámicos ---
  const [departamentos, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [municipios, setMunicipalities] = useState<{id: string, name: string, departmentId: string}[]>([]);
  const [segmentosDb, setSegmentosDb] = useState<ConfigItem[]>([]);
  const [riesgosDb, setRiesgosDb] = useState<ConfigItem[]>([]);
  const [tiposInteresDb, setTiposInteresDb] = useState<ConfigItem[]>([]);

  // 1. Cargar Datos Geográficos y Configuración al iniciar
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [deps, muns, segs, ries, ints, empresasData] = await Promise.all([
          geoClient.getDepartments(),
          geoClient.getMunicipalities(),
          configClient.getSegmentos(),
          configClient.getRiesgos(),
          configClient.getIntereses(),
          enterpriseClient.getAll(),
        ]);
        setDepartments(deps);
        setMunicipalities(muns);
        setSegmentosDb(segs);
        setRiesgosDb(ries);
        setTiposInteresDb(ints);
        if (segs.length > 0) setSegmento(segs[0]?.id || "");
        if (ints.length > 0) setInteres(ints[0]?.id || "");
        
        // Cargar empresas del usuario
        const items = Array.isArray(empresasData) ? (empresasData as Enterprise[]) : [];
        setEmpresasUser(items);
        
        // Prioridad de preselección: Scope (Asesor/Coordinador) > Cookie > Primera disponible
        const scopedId = getBrowserScopedEnterpriseId();
        const cookieId = getBrowserCookie("x-enterprise-id");
        const effectiveId = scopedId || cookieId;
          
        if (effectiveId && items.find((e: Enterprise) => e.id === effectiveId)) {
          setSelectedEmpresaId(effectiveId);
        } else if (items.length > 0) {
          setSelectedEmpresaId(items[0].id);
        }

      } catch (e) {
        console.error("Error loading initial data", e);
        toast.error("Error al cargar datos de configuración");
      }
    };
    loadInitialData();
  }, []);

  const [tipoCliente, setTipoCliente] = useState<"NATURAL" | "EMPRESA">("NATURAL");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [origen, setOrigen] = useState("");
  const [segmento, setSegmento] = useState("");
  const [interes, setInteres] = useState("");
  const [riesgoOverride, setRiesgoOverride] = useState<string | null>(null);
  const [metraje, setMetraje] = useState<number>(0);

  const sugerencias = useMemo(() => {
    const seg = segmentosDb.find(s => s.id === segmento);
    const int = tiposInteresDb.find(i => i.id === interes);

    // Lógica inteligente: tomar el riesgo más alto y la frecuencia más corta
    const riesgosMap: Record<string, number> = { "BAJO": 1, "MEDIO": 2, "ALTO": 3, "CRITICO": 4 };
    const riesgoSeg = seg?.riesgoSugerido || "BAJO";
    const riesgoInt = int?.riesgoSugerido || "BAJO";

    const riesgoFinal = (riesgosMap[riesgoSeg] ?? 1) >= (riesgosMap[riesgoInt] ?? 1) ? riesgoSeg : riesgoInt;

    const freqSeg = seg?.frecuenciaSugerida || 30;
    const freqInt = int?.frecuenciaSugerida || 30;
    const freqFinal = Math.min(freqSeg === 0 ? 999 : freqSeg, freqInt === 0 ? 999 : freqInt);

    return {
      riesgo: riesgoOverride || riesgoFinal,
      frecuencia: freqFinal === 999 ? "Puntual" : String(freqFinal),
      precioSugerido: metraje > 0 ? metraje * 1500 : 0,
      tiempoEstimado: metraje > 0 ? Math.ceil(metraje / 100) * 30 : 0,
    };
  }, [segmento, interes, riesgoOverride, metraje, segmentosDb, tiposInteresDb]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalStyle; };
  }, []);

  const [direcciones, setDirecciones] = useState<Direccion[]>([{
    id: Date.now(),
    direccion: "",
    linkMaps: "",
    departmentId: "",
    municipioId: "",
    municipio: "",
    barrio: "",
    piso: "",
    bloque: "",
    unidad: "",
    tipoUbicacion: "Residencial",
    clasificacionPunto: "Oficina administrativa",
    horarioInicio: "08:00",
    horarioFin: "18:00",
    restriccionesAcceso: "",
    nombreContacto: "",
    telefonoContacto: "",
    cargoContacto: "",
    activa: true,
    bloqueada: false,
    motivoBloqueo: "",
    latitud: "",
    longitud: "",
    precisionGPS: "",
    validadoPorSistema: false,
  }]);

  const handleDireccionChange = <K extends keyof Direccion>(id: number, field: K, value: Direccion[K]) => {
    setDirecciones(direcciones.map((d) => {
      if (d.id === id) {
        const update = { ...d, [field]: value };
        if (field === "departmentId") {
          update.municipioId = "";
          update.municipio = "";
        }
        if (field === "municipioId") {
          const mun = municipios.find(m => m.id === value);
          update.municipio = mun?.name || "";
        }
        if (field === "latitud" || field === "longitud") {
          update.validadoPorSistema = false;
        }
        return update;
      }
      return d;
    }));
  };

  const validarDireccion = async (id: number) => {
    const direccion = direcciones.find((d) => d.id === id);
    if (!direccion || !hasValidCoordinates(direccion.latitud, direccion.longitud)) {
      toast.error("Ingresá coordenadas válidas antes de marcar la dirección.");
      return;
    }

    handleDireccionChange(id, "validadoPorSistema", true);
    toast.success("Coordenadas validadas correctamente");
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const getText = (name: string) =>
      String(formData.get(name) ?? "").trim();
    const getOptionalText = (name: string) => getText(name) || undefined;
    const telefonoPrincipal = getText("telefono").replace(/\s+/g, "");

    if (!selectedEmpresaId) {
      toast.error("Seleccioná una empresa para crear el cliente.");
      return;
    }

    if (!telefonoPrincipal) {
      toast.error("Ingresá un teléfono principal.");
      return;
    }

    submitInFlightRef.current = true;
    setLoading(true);

    const cleanedDirecciones = direcciones.map(({
      id: _id,
      restriccionesAcceso,
      ...rest
    }) => ({
      ...rest,
      direccion: rest.direccion.trim() || DIRECCION_NO_CONCRETADA,
      municipioId: rest.municipioId || null,
      departmentId: rest.departmentId || null,
      restricciones: restriccionesAcceso || null,
      latitud: rest.latitud ? parseFloat(rest.latitud) : null,
      longitud: rest.longitud ? parseFloat(rest.longitud) : null,
      precisionGPS: rest.precisionGPS ? parseFloat(rest.precisionGPS) : null,
    }));

    const payload: ClienteDTO = {
      tipoCliente: (tipoCliente === "NATURAL" ? "PERSONA" : "EMPRESA") as "PERSONA" | "EMPRESA",
      nombre: getText("nombre") || "No Concretado",
      apellido: getText("apellido") || "No Concretado",
      tipoDocumento: tipoDocumento === "none" ? undefined : (tipoDocumento || undefined),
      numeroDocumento: getOptionalText("numeroDocumento"),
      telefono: telefonoPrincipal,
      telefono2: getOptionalText("telefono2"),
      correo: getOptionalText("correo"),
      origenCliente: origen || "No Concretado",
      tipoInteresId: getText("interes") || null,
      razonSocial: getText("razonSocial") || "No Concretado",
      nit: getOptionalText("nit"),
      actividadEconomica: getText("actividad") || "No Concretado",
      metrajeTotal: metraje ? parseFloat(metraje.toString()) : null,
      segmento: (segmento || null) as ClienteDTO["segmento"],
      nivelRiesgo: (riesgoOverride || riesgosDb.find(r => r.nombre === sugerencias.riesgo)?.id || null) as ClienteDTO["nivelRiesgo"],
      direcciones: cleanedDirecciones,
    };

    const finalPayload = { ...payload, empresaId: selectedEmpresaId || undefined } as unknown as ClienteDTO;

    try {
      const createdClient = await clientesClient.create(finalPayload);
      const createdClientId = (createdClient as { id?: string } | undefined)?.id;
      const createdClientDirecciones = (
        createdClient as { direcciones?: Array<{ id?: string }> } | undefined
      )?.direcciones;
      if (
        hasActiveContract &&
        createdClientId &&
        selectedEmpresaId
      ) {
        const contractPayload: ContratoClienteDTO = {
          empresaId: selectedEmpresaId,
          fechaInicio: contractStartDate,
          fechaFin: contractEndDate || null,
          serviciosComprometidos: contractServicesCommitted ? Number(contractServicesCommitted) : null,
          frecuenciaServicio: contractServiceFrequency ? Number(contractServiceFrequency) : null,
          tipoFacturacion: contractBillingType,
          observaciones: contractNotes || null,
        };

        await clientesClient.createContrato(
          createdClientId,
          contractPayload,
        );
      }
      toast.success("Cliente registrado con éxito");

      if (createdClientId) {
        const params = new URLSearchParams();
        params.set("cliente", createdClientId);

        if (selectedEmpresaId) {
          params.set("empresa", selectedEmpresaId);
        }

        const firstDireccionId = createdClientDirecciones?.[0]?.id;
        if (firstDireccionId) {
          params.set("direccion", firstDireccionId);
        }

        router.push(`/dashboard/servicios/nuevo?${params.toString()}`);
        return;
      }

      router.push("/dashboard/clientes");
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : "Error al crear cliente";
      if (message.includes('unique constraint') || message.includes('already exists')) {
        message = "Ya existe un cliente con esos datos en esta empresa.";
      }
      toast.error(message);
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  }

  const addDireccion = () => {
    setDirecciones([...direcciones, {
      id: Date.now(),
      direccion: "",
      linkMaps: "",
      departmentId: "",
      municipioId: "",
      municipio: "",
      barrio: "",
      piso: "",
      bloque: "",
      unidad: "",
      tipoUbicacion: "Residencial",
      clasificacionPunto: "Oficina administrativa",
      horarioInicio: "08:00",
      horarioFin: "18:00",
      restriccionesAcceso: "",
      nombreContacto: "",
      telefonoContacto: "",
      cargoContacto: "",
      activa: true,
      bloqueada: false,
      motivoBloqueo: "",
      latitud: "",
      longitud: "",
      precisionGPS: "",
      validadoPorSistema: false,
    }]);
  };

  const removeDireccion = (id: number) => {
    if (direcciones.length > 1) {
      setDirecciones(direcciones.filter(d => d.id !== id));
    } else {
      toast.error("Debe haber al menos una dirección");
    }
  };

  const getMunicipiosOptions = (deptId: string) => {
    return (Array.isArray(municipios) ? municipios : [])
      .filter(m => m.departmentId === deptId)
      .map(m => ({ value: m.id, label: m.name }));
  };

  if (isLoadingRole) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-[12px] font-medium text-muted-foreground">
        Validando permisos...
      </div>
    );
  }

  if (!checkPermission("CLIENT_CREATE")) {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 w-full flex-col px-3 py-3 sm:px-4 lg:px-5">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">

        <div className="flex-none border-b border-border bg-card px-4 py-3 lg:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/clientes")} className="h-8 w-8 rounded-[5px] border border-border hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-[15px] font-medium tracking-tight text-foreground">Registro de Clientes</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#01ADFB]"></span>
                <p className="text-[10px] text-muted-foreground font-medium tracking-[0.08em]">Alta comercial y operativa</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex w-full max-w-fit rounded-[6px] border border-border bg-muted p-0.5 lg:mt-0">
            <button type="button" onClick={() => setTipoCliente("NATURAL")} className={`flex h-7 items-center gap-1.5 rounded-[5px] px-3 text-[10px] font-medium transition-all ${tipoCliente === "NATURAL" ? "bg-background text-[#01ADFB] shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"}`}><UserCircle2 className="h-4 w-4" /> Persona natural</button>
            <button type="button" onClick={() => setTipoCliente("EMPRESA")} className={`flex h-7 items-center gap-1.5 rounded-[5px] px-3 text-[10px] font-medium transition-all ${tipoCliente === "EMPRESA" ? "bg-background text-[#01ADFB] shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"}`}><Building2 className="h-4 w-4" /> Empresa</button>
          </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background px-4 py-4 custom-scrollbar lg:px-5">
          <form id="cliente-form" onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl space-y-5 pb-6">

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-[6px] flex gap-4 items-start">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300">Nota</p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed font-medium">
                  Los campos sin asterisco rojo (<span className="font-medium text-red-500">*</span>) pueden quedar vacíos; se marcarán como pendientes para que el registro avance sin bloquear la operación.
                </p>
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex items-center gap-3 border-b border-border pb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground"><Target className="h-4 w-4" /></div>
                <h2 className="text-[15px] font-medium tracking-tight text-foreground">Configuración de Perfil</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Asignar a Empresa <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedEmpresaId}
                    onValueChange={(val) => setSelectedEmpresaId(val)}
                    name="empresaId"
                    required
                  >
                    <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Seleccionar empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {empresasUser.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {tipoCliente === "NATURAL" ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Nombre(s)</Label>
                      <Input name="nombre" className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: Juan" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Apellido(s)</Label>
                      <Input name="apellido" className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: Valdés" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Tipo de Documento</Label>
                      <Select
                        value={tipoDocumento}
                        onValueChange={setTipoDocumento}
                        name="tipoDocumento"
                      >
                        <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="No especificado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No especificado</SelectItem>
                          {TIPOS_DOCUMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Número de Documento</Label>
                      <Input name="numeroDocumento" className="h-9 rounded-[4px] border-border bg-background font-mono text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="12345678" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9.\-]/g, ''); }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[11px] text-muted-foreground">Razón Social</Label>
                      <Input name="razonSocial" className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </div>
                    <input type="hidden" name="tipoDocumento" value="NIT" />
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">NIT / Identificación</Label>
                      <Input name="nit" className="h-9 rounded-[4px] border-border bg-background font-mono text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9.\-]/g, ''); }} />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Teléfono Principal <span className="text-red-500">*</span></Label>
                  <Input name="telefono" required className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="3000000000" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9.\-]/g, ''); }} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Teléfono Secundario (Opcional)</Label>
                  <Input name="telefono2" className="h-9 border-border focus-visible:ring-0 focus-visible:ring-offset-0 bg-background text-foreground opacity-80" placeholder="3111111111" onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9.\-]/g, ''); }} />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Segmento del Negocio</Label>
                  <Select name="segmento" value={segmento} onValueChange={setSegmento}>
                    <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Seleccionar segmento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {segmentosDb.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Nivel de Riesgo Operativo</Label>
                  <Select value={riesgoOverride || riesgosDb.find(r => r.nombre === sugerencias.riesgo)?.id || ""} onValueChange={setRiesgoOverride} name="nivelRiesgo">
                    <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Seleccionar riesgo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {riesgosDb.map(r => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Canal de Captación</Label>
                  <Select name="origen" value={origen} onValueChange={setOrigen}>
                    <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Seleccionar origen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGENES_CLIENTE.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Correo Electrónico (Opcional)</Label>
                  <Input name="correo" type="email" pattern="^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="Debe incluir un '@' y un '.'" className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="usuario@ejemplo.com" />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Tipo de Servicio Interés</Label>
                  <Select name="interes" value={interes} onValueChange={setInteres}>
                    <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Seleccionar interés..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposInteresDb.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {tipoCliente === "EMPRESA" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Actividad Económica</Label>
                      <Input name="actividad" className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: Venta de alimentos" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Área Instalaciones (m²)</Label>
                      <Input type="number" name="metraje" value={metraje} onChange={(e) => setMetraje(Number(e.target.value))} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </div>
                  </>
                )}
              </div>

              {(segmento || interes) && (
                <div className="p-4 bg-[#01ADFB]/5 border border-[#01ADFB]/20 rounded-[6px] space-y-4">
                  <div className="flex items-center gap-2 text-[#01ADFB]">
                    <Lightbulb className="h-4 w-4" />
                    <span className="text-[12px] font-medium tracking-[0.08em]">Recomendación</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                    Según el segmento <span className="font-medium text-foreground">{segmentosDb.find(s => s.id === segmento)?.nombre}</span> y el interés <span className="font-medium text-foreground">{tiposInteresDb.find(i => i.id === interes)?.nombre}</span>, se sugiere un riesgo <span className="font-medium text-[#01ADFB]">{sugerencias.riesgo}</span> con una frecuencia <span className="font-medium text-[#01ADFB]">{sugerencias.frecuencia === "Puntual" ? "Única" : `cada ${sugerencias.frecuencia} días`}</span>.
                  </p>
                </div>
              )}

              {tipoCliente === "EMPRESA" && segmento && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted border border-border rounded-[6px]">
                  <div className="space-y-1.5"><p className="text-[9px] font-medium text-muted-foreground tracking-[0.12em]">Frecuencia Ideal</p><div className="flex items-center gap-2 font-medium text-foreground text-[12px]"><CalendarClock className="h-3.5 w-3.5 text-[#01ADFB]" /> {sugerencias.frecuencia} días</div></div>
                  <div className="space-y-1.5"><p className="text-[9px] font-medium text-muted-foreground tracking-[0.12em]">Tiempo de Labor</p><div className="flex items-center gap-2 font-medium text-foreground text-[12px]"><Clock className="h-3.5 w-3.5 text-[#01ADFB]" /> {sugerencias.tiempoEstimado} min</div></div>
                  <div className="space-y-1.5"><p className="text-[9px] font-medium text-muted-foreground tracking-[0.12em]">Tarifa Sugerida</p><div className="flex items-center gap-2 font-medium text-emerald-600 text-[12px]">$ {sugerencias.precioSugerido.toLocaleString()}</div></div>
                  <div className="space-y-1.5"><p className="text-[9px] font-medium text-muted-foreground tracking-[0.12em]">Estatus de Cuenta</p><div className="flex items-center gap-2 font-medium text-amber-600 text-[12px]"><Zap className="h-3.5 w-3.5 fill-amber-600" /> POTENCIAL</div></div>
                </div>
              )}
            </section>

            {
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-border pb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground"><CalendarClock className="h-4 w-4" /></div>
                  <div>
                    <h2 className="text-[15px] font-medium tracking-tight text-foreground">Condiciones Comerciales</h2>
                    <p className="text-[11px] text-muted-foreground">Define si este cliente entra con contrato activo y cómo se cobrarán sus servicios.</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-[6px] border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4 rounded-[5px] border border-border bg-muted/40 px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-[12px] font-medium text-foreground">Activar contrato comercial</p>
                      <p className="text-[11px] text-muted-foreground">
                        Si lo activas, los nuevos servicios de este cliente heredarán el tipo de facturación del contrato.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={hasActiveContract ? "default" : "outline"}
                      onClick={() => setHasActiveContract((current) => !current)}
                      className="h-8 min-w-[128px] rounded-[4px] text-[10px] font-medium tracking-[0.08em]"
                    >
                      {hasActiveContract ? "Contrato activo" : "Sin contrato"}
                    </Button>
                  </div>

                  {hasActiveContract ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Fecha inicio <span className="text-red-500">*</span></Label>
                        <Input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} required={hasActiveContract} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Fecha fin</Label>
                        <Input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Servicios comprometidos</Label>
                        <Input type="number" min="1" value={contractServicesCommitted} onChange={(e) => setContractServicesCommitted(e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="12" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Frecuencia operativa (días)</Label>
                        <Input type="number" min="1" value={contractServiceFrequency} onChange={(e) => setContractServiceFrequency(e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="30" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[11px] text-muted-foreground">Tipo de facturación <span className="text-red-500">*</span></Label>
                        <Select value={contractBillingType} onValueChange={(value) => setContractBillingType(value as ContratoClienteDTO["tipoFacturacion"])}>
                          <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Seleccionar facturación..." />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_FACTURACION_CONTRATO.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[11px] text-muted-foreground">Observaciones comerciales</Label>
                        <textarea
                          value={contractNotes}
                          onChange={(e) => setContractNotes(e.target.value)}
                          placeholder="Ej: contrato anual con 12 visitas y corte trimestral."
                          className="min-h-[92px] w-full rounded-[4px] border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none transition focus:border-[#01ADFB]"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            }

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground"><MapPin className="h-4 w-4" /></div>
                  <h2 className="text-[15px] font-medium tracking-tight text-foreground">{tipoCliente === "NATURAL" ? "Información de Residencia" : "Sedes Operativas"}</h2>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addDireccion} className="gap-2 h-9 text-[#01ADFB] border-border hover:bg-muted font-medium text-[10px] tracking-[0.08em] uppercase bg-background">
                  <Plus className="h-3.5 w-3.5" /> {tipoCliente === "NATURAL" ? "Agregar dirección" : "Agregar sede"}
                </Button>
              </div>

              <div className="space-y-4">
                {direcciones.map((dir) => (
                  <div key={dir.id} className="relative space-y-4 rounded-[6px] border border-border bg-card p-4 transition-colors hover:bg-muted/20">
                    {direcciones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDireccion(dir.id)}
                        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[11px] text-muted-foreground">Dirección Principal</Label>
                        <div className="flex gap-3">
                          <Input value={dir.direccion} onChange={(e) => handleDireccionChange(dir.id, "direccion", e.target.value)} className="h-9 border-border focus-visible:ring-0 focus-visible:ring-offset-0 bg-background text-foreground text-[12px]" placeholder="Calle 123 # 45 - 67" />
                          <Button type="button" onClick={() => validarDireccion(dir.id)} className="h-9 gap-1.5 rounded-[4px] border-none bg-[#01ADFB] px-3 text-[10px] font-medium text-white shadow-sm shadow-[#01ADFB]/20 transition-colors hover:bg-[#0197dc]"><Search className="h-4 w-4" /> Validar</Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Referencia Maps</Label>
                        <Input value={dir.linkMaps} onChange={(e) => handleDireccionChange(dir.id, "linkMaps", e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Enlace de ubicación" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] text-muted-foreground">Departamento</Label>
                          <Combobox
                            options={Array.isArray(departamentos) ? departamentos.map(d => ({ value: d.id, label: d.name })) : []}
                            value={dir.departmentId || ""}
                            onChange={(v) => handleDireccionChange(dir.id, "departmentId", v)}
                            placeholder={departamentos.length > 0 ? "Seleccionar..." : "Cargando..."}
                            className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:border-border [&>button]:bg-background [&>button]:text-[12px] [&>button]:focus:ring-0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] text-muted-foreground">Municipio</Label>
                          <Combobox
                            options={getMunicipiosOptions(dir.departmentId || "")}
                            value={dir.municipioId || ""}
                            onChange={(v) => handleDireccionChange(dir.id, "municipioId", v)}
                            placeholder={dir.departmentId ? "Seleccionar..." : "Elija departamento"}
                            disabled={!dir.departmentId}
                            className="[&>button]:h-9 [&>button]:rounded-[4px] [&>button]:border-border [&>button]:bg-background [&>button]:text-[12px] [&>button]:focus:ring-0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Apto / Piso / Local</Label>
                        <Input value={dir.piso} onChange={(e) => handleDireccionChange(dir.id, "piso", e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: 201" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Bloque / Torre / Conjunto</Label>
                        <Input value={dir.bloque} onChange={(e) => handleDireccionChange(dir.id, "bloque", e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: Torre B" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Unidad / Edificio / Vereda</Label>
                        <Input value={dir.unidad} onChange={(e) => handleDireccionChange(dir.id, "unidad", e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: San Juan" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">{tipoCliente === "NATURAL" ? "Tipo Vivienda" : "Clasificación"}</Label>
                        {tipoCliente === "NATURAL" ? (
                          <Select
                            value={dir.tipoUbicacion}
                            onValueChange={(val) => handleDireccionChange(dir.id, "tipoUbicacion", val)}
                          >
                            <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASA">CASA</SelectItem>
                              <SelectItem value="APTO">APARTAMENTO</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={dir.clasificacionPunto}
                            onValueChange={(val) => handleDireccionChange(dir.id, "clasificacionPunto", val)}
                          >
                            <SelectTrigger className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus:ring-0 focus:ring-offset-0">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {CLASIFICACIONES_PUNTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Barrio / Sector</Label>
                        <Input value={dir.barrio} onChange={(e) => handleDireccionChange(dir.id, "barrio", e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: El Poblado" />
                      </div>
                      {tipoCliente === "NATURAL" && (
                        <div className="space-y-2">
                          <Label className="text-[11px] text-muted-foreground">Indicaciones Opcionales</Label>
                          <Input value={dir.restriccionesAcceso} onChange={(e) => handleDireccionChange(dir.id, "restriccionesAcceso", e.target.value)} className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Ej: Portón café, cerca al parque" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-3 rounded-[5px] border border-border bg-muted/50 p-3 md:flex-row">
                      <div className="flex-1 w-full space-y-1.5"><Label className="text-[10px] font-medium text-[#01ADFB] tracking-[0.12em]">Latitud Geográfica</Label><Input value={dir.latitud} onChange={(e) => handleDireccionChange(dir.id, "latitud", e.target.value.replace(/[^0-9.-]/g, ''))} pattern="^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)$" title="Latitud válida entre -90 y 90" className="h-8 border-border focus-visible:ring-0 focus-visible:ring-offset-0 bg-background text-foreground font-mono text-[12px]" placeholder="0.0000" /></div>
                      <div className="flex-1 w-full space-y-1.5"><Label className="text-[10px] font-medium text-[#01ADFB] tracking-[0.12em]">Longitud Geográfica</Label><Input value={dir.longitud} onChange={(e) => handleDireccionChange(dir.id, "longitud", e.target.value.replace(/[^0-9.-]/g, ''))} pattern="^[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$" title="Longitud válida entre -180 y 180" className="h-8 border-border focus-visible:ring-0 focus-visible:ring-offset-0 bg-background text-foreground font-mono text-[12px]" placeholder="0.0000" /></div>
                      <div className={`flex h-8 items-center gap-1.5 rounded-[4px] border px-3 text-[10px] font-medium transition-all ${dir.validadoPorSistema ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-background text-muted-foreground border-border"}`}>{dir.validadoPorSistema ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {dir.validadoPorSistema ? "Georreferenciado" : "Pendiente"}</div>
                    </div>

                    {tipoCliente === "EMPRESA" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6 border-t border-border">
                        <div className="space-y-5">
                          <div className="flex items-center gap-2 text-muted-foreground font-medium text-[10px] tracking-[0.08em]"><Clock className="h-4 w-4" /> Ventana Operativa</div>
                          <div className="flex gap-3">
                            <TimePicker
                              value={dir.horarioInicio}
                              onChange={(val) => handleDireccionChange(dir.id, "horarioInicio", val)}
                              className="h-9 border-border focus-within:ring-0 focus-within:border-border bg-background"
                            />
                            <TimePicker
                              value={dir.horarioFin}
                              onChange={(val) => handleDireccionChange(dir.id, "horarioFin", val)}
                              className="h-9 border-border focus-within:ring-0 focus-within:border-border bg-background"
                            />
                          </div>
                        </div>
                        <div className="space-y-5">
                          <div className="flex items-center gap-2 text-muted-foreground font-medium text-[10px] tracking-[0.08em]"><Contact2 className="h-4 w-4" /> Responsable Directo</div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input value={dir.nombreContacto} onChange={(e) => handleDireccionChange(dir.id, "nombreContacto", e.target.value)} placeholder="Nombre" className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
                            <Input value={dir.telefonoContacto} onChange={(e) => handleDireccionChange(dir.id, "telefonoContacto", e.target.value)} placeholder="Móvil" className="h-9 rounded-[4px] border-border bg-background text-[12px] text-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </form>
        </div>

        <div className="flex-none border-t border-border bg-card px-4 py-3 lg:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden items-center gap-2 text-muted-foreground lg:flex">
            <GanttChart className="h-4 w-4 text-[#01ADFB]" />
            <p className="max-w-xs text-[11px] leading-relaxed">El registro deja al cliente listo para sus próximos servicios.</p>
          </div>
            <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push("/dashboard/clientes")} className="h-8 rounded-[4px] px-3 text-[10px] font-medium text-muted-foreground hover:bg-muted">Cancelar</Button>
            <Button
              type="submit"
              form="cliente-form"
              disabled={loading}
              className="h-8 gap-2 rounded-[4px] border-none bg-[#01ADFB] px-4 text-[10px] font-medium text-white shadow-sm shadow-[#01ADFB]/20 transition-colors hover:bg-[#0197dc]"
            >
              {loading ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="text-[10px] font-medium text-white">Guardar cliente</span>
            </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NuevoClientePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="flex h-[80vh] items-center justify-center text-[12px] font-medium text-muted-foreground">Cargando registro...</div>}>
        <NuevoClienteContent />
      </Suspense>
    </DashboardLayout>
  );
}
