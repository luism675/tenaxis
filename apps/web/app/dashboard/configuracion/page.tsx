"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  authClient,
} from "@/lib/api/auth-client";
import {
  configClient,
  type DiaSemana,
  type PicoPlacaRule,
} from "@/lib/api/config-client";
import { enterpriseClient } from "@/lib/api/enterprise-client";
import { tenantsClient } from "@/lib/api/tenants-client";
import { DashboardLayout } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Select as SelectShadcn,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select-shadcn";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Settings, 
  Zap,
  Bug,
  Plus, 
  Pencil, 
  Save, 
  X,
  Building,
  User,
  CreditCard,
  Briefcase,
  ShieldCheck,
  CalendarClock,
  AlertTriangle,
  Car,
  Bike,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { ConfigEmpresas } from "@/components/dashboard/ConfigEmpresas";

type TabType = "intereses" | "servicios" | "empresas" | "picoPlaca" | "perfil";

type TipoInteres = {
  id: string;
  nombre: string;
  descripcion: string | null;
  frecuenciaSugerida?: number;
  riesgoSugerido?: string;
  activo: boolean;
};

type UserProfile = {
  membershipId?: string;
  id?: string;
  empresaId?: string;
  nombre?: string;
  apellido?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  telefono?: string;
  phone?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  valorHora?: number;
  email?: string;
  role?: string;
};

type ServicioConfig = {
  id: string;
  nombre: string;
  empresaId: string;
  activo?: boolean;
  requiereSeguimiento?: boolean;
  primerSeguimientoDias?: number | null;
  requiereSeguimientoTresMeses?: boolean;
};

type Empresa = {
  id: string;
  nombre: string;
};

type PicoPlacaRuleForm = {
  id?: string;
  dia: DiaSemana;
  label: string;
  numeroUno: string;
  numeroDos: string;
  activo: boolean;
};

const TIPOS_CUENTA = ['Ahorros', 'Corriente', 'Monedero (Nequi/Daviplata)', 'Otro'];
const BANCOS_COLOMBIA = [
  "Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA Colombia", "Banco de Occidente",
  "Banco Popular", "Scotiabank Colpatria", "Itaú", "Banco GNB Sudameris", "Banco Caja Social",
  "Banco AV Villas", "Banco Agrario", "Nequi", "Daviplata", "NuBank", "Lulo Bank"
];

const TIPOS_DOCUMENTO = [
  "Cédula de Ciudadanía", "Cédula de Extranjería", "NIT", "Pasaporte", "Tarjeta de Identidad"
];

const TAB_LABELS: Record<TabType, string> = {
  intereses: "Intereses",
  servicios: "Servicios",
  empresas: "Empresas",
  picoPlaca: "Pico y Placa",
  perfil: "Perfil",
};

const DIAS_PICO_PLACA: Array<{ dia: DiaSemana; label: string }> = [
  { dia: "LUNES", label: "Lunes" },
  { dia: "MARTES", label: "Martes" },
  { dia: "MIERCOLES", label: "Miércoles" },
  { dia: "JUEVES", label: "Jueves" },
  { dia: "VIERNES", label: "Viernes" },
  { dia: "SABADO", label: "Sábado" },
  { dia: "DOMINGO", label: "Domingo" },
];

const DIGITOS_PICO_PLACA = Array.from({ length: 10 }, (_, index) => String(index));

const isValidTab = (value: string): value is TabType =>
  ["intereses", "servicios", "empresas", "picoPlaca", "perfil"].includes(value);

const getStoredUser = (): UserProfile | null => {
  if (typeof window === "undefined") return null;

  const userData = localStorage.getItem("user");
  if (!userData || userData === "undefined") return null;

  try {
    return JSON.parse(userData) as UserProfile;
  } catch {
    return null;
  }
};

const createDefaultPicoPlacaRules = (): PicoPlacaRuleForm[] =>
  DIAS_PICO_PLACA.map((day) => ({
    ...day,
    numeroUno: "0",
    numeroDos: "1",
    activo: false,
  }));

const mergePicoPlacaRules = (rules: PicoPlacaRule[]): PicoPlacaRuleForm[] => {
  const rulesByDay = new Map(rules.map((rule) => [rule.dia, rule]));

  return DIAS_PICO_PLACA.map((day) => {
    const rule = rulesByDay.get(day.dia);

    return {
      ...day,
      id: rule?.id,
      numeroUno: String(rule?.numeroUno ?? 0),
      numeroDos: String(rule?.numeroDos ?? 1),
      activo: rule?.activo ?? false,
    };
  });
};

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<TabType>("intereses");
  const [loading, setLoading] = useState(true);
  const [intereses, setIntereses] = useState<TipoInteres[]>([]);
  const [servicios, setServicios] = useState<ServicioConfig[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isServicioModalOpen, setIsServicioModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TipoInteres | null>(null);
  const [editingServicio, setEditingServicio] = useState<ServicioConfig | null>(null);
  const [picoPlacaRules, setPicoPlacaRules] = useState<PicoPlacaRuleForm[]>(
    () => createDefaultPicoPlacaRules(),
  );
  const [picoPlacaSaving, setPicoPlacaSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await authClient.getProfile();
        if (profile) {
          setUser((prev) => ({
            ...prev,
            ...profile,
          }));
          localStorage.setItem("user", JSON.stringify({
            ...getStoredUser(),
            ...profile,
          }));
        }
      } catch {
        // fallback silencioso al cache local
      }
    };

    loadProfile().catch(() => {
      // noop
    });

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && isValidTab(hash)) {
        setActiveTab(hash);
      }
    };
    const frameId = requestAnimationFrame(() => {
      const storedUser = getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }
      handleHashChange();
    });
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ints = await configClient.getIntereses();
      setIntereses(ints as unknown as TipoInteres[]);
    } catch (_error) {
      toast.error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadServiciosData = useCallback(async () => {
    setLoading(true);
    try {
      const empresasResult = await enterpriseClient.getAll();
      const loadedEmpresas = (
        Array.isArray(empresasResult)
          ? empresasResult
          : (empresasResult as { items?: Empresa[] })?.items || []
      ) as Empresa[];

      setEmpresas(loadedEmpresas);

      const currentEmpresaId =
        selectedEmpresaId ||
        localStorage.getItem("current-enterprise-id") ||
        loadedEmpresas[0]?.id ||
        "";

      setSelectedEmpresaId(currentEmpresaId);

      const serviciosResult = await configClient.getServicios(currentEmpresaId || undefined);
      setServicios(Array.isArray(serviciosResult) ? (serviciosResult as ServicioConfig[]) : []);
    } catch (_error) {
      toast.error("Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }, [selectedEmpresaId]);

  const loadPicoPlacaData = useCallback(async (empresaIdOverride?: string) => {
    setLoading(true);
    try {
      const empresasResult = await enterpriseClient.getAll();
      const loadedEmpresas = (
        Array.isArray(empresasResult)
          ? empresasResult
          : (empresasResult as { items?: Empresa[] })?.items || []
      ) as Empresa[];

      setEmpresas(loadedEmpresas);

      const currentEmpresaId =
        empresaIdOverride ||
        selectedEmpresaId ||
        localStorage.getItem("current-enterprise-id") ||
        loadedEmpresas[0]?.id ||
        "";

      setSelectedEmpresaId(currentEmpresaId);

      if (!currentEmpresaId) {
        setPicoPlacaRules(createDefaultPicoPlacaRules());
        return;
      }

      const rules = await configClient.getPicoPlaca(currentEmpresaId);
      setPicoPlacaRules(mergePicoPlacaRules(rules));
    } catch (_error) {
      toast.error("Error al cargar pico y placa");
    } finally {
      setLoading(false);
    }
  }, [selectedEmpresaId]);

  useEffect(() => {
    if (activeTab === 'intereses') {
      loadData().catch(() => {
        toast.error("Error al cargar la configuración");
      });
    }
    if (activeTab === 'servicios') {
      loadServiciosData().catch(() => {
        toast.error("Error al cargar los servicios");
      });
    }
    if (activeTab === 'picoPlaca') {
      loadPicoPlacaData().catch(() => {
        toast.error("Error al cargar pico y placa");
      });
    }
  }, [activeTab, loadData, loadServiciosData, loadPicoPlacaData]);

  const handleOpenModal = (item: TipoInteres | null = null) => {
    setEditingItem(item);
    setEditingServicio(null);
    setIsModalOpen(true);
  };

  const handleOpenServicioModal = (item: ServicioConfig | null = null) => {
    setEditingServicio(item);
    setEditingItem(null);
    setIsServicioModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingItem(null);
    setEditingServicio(null);
    setIsModalOpen(false);
    setIsServicioModalOpen(false);
  };

  const handleSaveProfile = async () => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      
      if (user.membershipId) {
        try {
          const currentEnterpriseId = localStorage.getItem("current-enterprise-id") || user.empresaId;
          await tenantsClient.updateMembership(user.membershipId, {
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono,
            tipoDocumento: user.tipoDocumento,
            numeroDocumento: user.numeroDocumento,
            banco: user.banco,
            tipoCuenta: user.tipoCuenta,
            numeroCuenta: user.numeroCuenta,
            valorHora: user.valorHora,
            cuentaPagoEmpresaId: currentEnterpriseId,
          });

          const profile = await authClient.getProfile();
          if (profile) {
            const merged = { ...user, ...profile };
            setUser(merged);
            localStorage.setItem("user", JSON.stringify(merged));
          }
          toast.success("Perfil actualizado correctamente");
        } catch (error) {
          console.error("Connection error during sync", error);
          toast.error("No se pudo guardar el perfil");
        }
      } else {
        toast.success("Perfil actualizado localmente");
      }
    }
  };

  const updateProfileField = (field: keyof UserProfile, value: string | number | undefined) => {
    if (user) setUser(prev => prev ? { ...prev, [field]: value } : null);
  };

  const updatePicoPlacaRule = (
    dia: DiaSemana,
    field: "numeroUno" | "numeroDos" | "activo",
    value: string | boolean,
  ) => {
    setPicoPlacaRules((currentRules) =>
      currentRules.map((rule) =>
        rule.dia === dia ? { ...rule, [field]: value } : rule,
      ),
    );
  };

  const handlePicoPlacaEmpresaChange = (empresaId: string) => {
    setSelectedEmpresaId(empresaId);
    localStorage.setItem("current-enterprise-id", empresaId);
    loadPicoPlacaData(empresaId).catch(() => {
      toast.error("Error al cargar pico y placa");
    });
  };

  const handleSavePicoPlaca = async () => {
    if (!selectedEmpresaId) {
      toast.error("Seleccioná una empresa antes de guardar pico y placa");
      return;
    }

    const reglas = picoPlacaRules.map((rule) => ({
      dia: rule.dia,
      numeroUno: Number(rule.numeroUno),
      numeroDos: Number(rule.numeroDos),
      activo: rule.activo,
    }));

    const invalidRule = reglas.find(
      (rule) =>
        !Number.isInteger(rule.numeroUno) ||
        !Number.isInteger(rule.numeroDos) ||
        rule.numeroUno < 0 ||
        rule.numeroUno > 9 ||
        rule.numeroDos < 0 ||
        rule.numeroDos > 9,
    );

    if (invalidRule) {
      toast.error("Cada regla debe usar dígitos entre 0 y 9");
      return;
    }

    const repeatedRule = reglas.find(
      (rule) => rule.activo && rule.numeroUno === rule.numeroDos,
    );
    if (repeatedRule) {
      toast.error(`El ${TAB_LABELS.picoPlaca} no puede repetir dígitos en ${repeatedRule.dia}`);
      return;
    }

    setPicoPlacaSaving(true);
    try {
      const savedRules = await configClient.updatePicoPlaca(selectedEmpresaId, reglas);
      setPicoPlacaRules(mergePicoPlacaRules(savedRules));
      toast.success("Pico y placa guardado correctamente");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error al guardar pico y placa";
      toast.error(message);
    } finally {
      setPicoPlacaSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const entries = Object.fromEntries(formData.entries());
    try {
      if (activeTab === "intereses") {
        const data = {
          nombre: entries.nombre as string,
          descripcion: entries.descripcion as string || null,
          frecuenciaSugerida: parseInt(entries.frecuenciaSugerida as string) || 30,
          riesgoSugerido: entries.riesgoSugerido as string || "BAJO",
        };
        if (editingItem) await configClient.updateInteres(editingItem.id, data);
        else await configClient.createInteres(data);
      } else if (activeTab === "servicios") {
        if (!selectedEmpresaId) {
          throw new Error("Selecciona una empresa antes de guardar el servicio");
        }

        const requiereSeguimiento = entries.requiereSeguimiento === "on";
        const requiereSeguimientoTresMeses =
          entries.requiereSeguimientoTresMeses === "on";
        const primerSeguimientoDiasRaw = entries.primerSeguimientoDias as string;

        const commonData = {
          nombre: entries.nombre as string,
          activo: entries.activo === "on",
          requiereSeguimiento,
          primerSeguimientoDias:
            requiereSeguimiento && primerSeguimientoDiasRaw
              ? parseInt(primerSeguimientoDiasRaw, 10)
              : undefined,
          requiereSeguimientoTresMeses,
        };

        if (editingServicio) {
          await configClient.updateServicio(editingServicio.id, commonData);
        } else {
          await configClient.createServicio({
            ...commonData,
            empresaId: selectedEmpresaId,
          });
        }
      }
      toast.success("Guardado exitosamente");
      if (activeTab === "intereses") {
        loadData().catch(() => {
          toast.error("Error al recargar datos");
        });
      } else if (activeTab === "servicios") {
        loadServiciosData().catch(() => {
          toast.error("Error al recargar servicios");
        });
      }
      handleCloseModal();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error al guardar";
      toast.error(message);
    }
  };

  return (
    <DashboardLayout overflowHidden>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="shrink-0 border-b border-border bg-background px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <Settings className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-[17px] font-medium tracking-tight text-foreground">
                  Configuración del negocio
                </h1>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  Personaliza los parámetros operativos de tu empresa
                </p>
              </div>
            </div>

            <div className="flex gap-0 overflow-x-auto border-t border-border pt-1">
              {(["intereses", "servicios", "empresas", "picoPlaca", "perfil"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[11px] font-medium tracking-[0.02em] transition-colors",
                    activeTab === tab
                      ? "border-[#01ADFB] text-[#01ADFB]"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === "intereses" && <Bug className="h-3.5 w-3.5" />}
                  {tab === "servicios" && <Briefcase className="h-3.5 w-3.5" />}
                  {tab === "empresas" && <Building className="h-3.5 w-3.5" />}
                  {tab === "picoPlaca" && <Car className="h-3.5 w-3.5" />}
                  {tab === "perfil" && <User className="h-3.5 w-3.5" />}
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contenedor Principal de Datos (Scrollable) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-5xl pb-20">
            {activeTab === 'perfil' ? (
              <div className="space-y-4">
                <Card className="border-border bg-card shadow-sm rounded-lg overflow-hidden">
                  <CardHeader className="px-5 py-4 border-b border-border bg-card">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-[#01ADFB]/10 flex items-center justify-center text-[#01ADFB]"><User className="h-6 w-6" /></div>
                      <div><CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Información Personal</CardTitle><CardDescription className="mt-1 text-[11px] font-medium text-muted-foreground">Detalles básicos de tu cuenta</CardDescription></div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Nombre</Label><Input value={user?.nombre || ""} onChange={(e) => updateProfileField("nombre", e.target.value)} className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Apellido</Label><Input value={user?.apellido || ""} onChange={(e) => updateProfileField("apellido", e.target.value)} className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Correo Electrónico</Label><Input type="email" value={user?.email || ""} onChange={(e) => updateProfileField("email", e.target.value)} className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Celular</Label><Input value={user?.telefono || ""} onChange={(e) => updateProfileField("telefono", e.target.value)} className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" /></div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Tipo Documento</Label>
                      <SelectShadcn value={user?.tipoDocumento || ""} onValueChange={(value) => updateProfileField("tipoDocumento", value)}>
                        <SelectTrigger className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus:border-[#01ADFB] focus:ring-2 focus:ring-[#01ADFB]/10">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_DOCUMENTO.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                          ))}
                        </SelectContent>
                      </SelectShadcn>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Documento</Label><Input value={user?.numeroDocumento || ""} onChange={(e) => updateProfileField("numeroDocumento", e.target.value)} className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" /></div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-lg border-border bg-muted/30 shadow-none">
                  <CardHeader className="border-b border-border/70 bg-muted/20 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-[#01ADFB]"><CreditCard className="h-4 w-4" /></div>
                      <div>
                        <CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Información Bancaria</CardTitle>
                        <CardDescription className="mt-1 text-[11px] font-medium text-muted-foreground">
                          Datos para la dispersión de pagos y honorarios
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Banco / Entidad</Label>
                      <SelectShadcn value={user?.banco || ""} onValueChange={(value) => updateProfileField("banco", value)}>
                        <SelectTrigger className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus:border-[#01ADFB] focus:ring-2 focus:ring-[#01ADFB]/10">
                          <SelectValue placeholder="Seleccione un banco..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BANCOS_COLOMBIA.map((banco) => (
                            <SelectItem key={banco} value={banco}>{banco}</SelectItem>
                          ))}
                        </SelectContent>
                      </SelectShadcn>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Tipo de Cuenta</Label>
                      <SelectShadcn value={user?.tipoCuenta || ""} onValueChange={(value) => updateProfileField("tipoCuenta", value)}>
                        <SelectTrigger className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus:border-[#01ADFB] focus:ring-2 focus:ring-[#01ADFB]/10">
                          <SelectValue placeholder="Seleccione el tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_CUENTA.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                          ))}
                        </SelectContent>
                      </SelectShadcn>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Número de Cuenta</Label>
                      <Input 
                        placeholder="Ej: 123456789"
                        value={user?.numeroCuenta || ""} 
                        onChange={(e) => updateProfileField("numeroCuenta", e.target.value)} 
                        className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Valor Hora de Servicio</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                        <Input 
                          type="text" 
                          placeholder="0"
                          value={user?.valorHora ? user.valorHora.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""} 
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            updateProfileField("valorHora", val ? parseInt(val, 10) : 0);
                          }} 
                          className="h-9 rounded-md border-border/80 bg-background pl-7 pr-3 text-[12px] font-medium text-emerald-600 shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end"><Button onClick={handleSaveProfile} className="bg-[#01ADFB] hover:bg-blue-700 text-white font-medium text-[10px] rounded-md h-8 px-3 shadow-sm shadow-[#01ADFB]/20 transition-all active:scale-95 flex items-center gap-1.5"><Save className="h-4 w-4" /> GUARDAR CAMBIOS</Button></div>
              </div>
            ) : activeTab === 'empresas' ? (
              <ConfigEmpresas />
            ) : activeTab === 'picoPlaca' ? (
              <Card className="border-border bg-card shadow-sm rounded-lg overflow-hidden">
                <CardHeader className="flex flex-col gap-6 px-5 py-4 border-b border-border bg-card">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Pico y Placa Operativo</CardTitle>
                      <CardDescription className="font-bold text-[10px] uppercase text-muted-foreground tracking-[0.18em]">
                        Reglas manuales por empresa para asignación de operadores
                      </CardDescription>
                      <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
                        La autoasignación excluye operadores restringidos. Si un asesor fuerza la asignación manual,
                        se muestra un aviso sin bloquear para que la operación pueda decidir con criterio.
                      </p>
                    </div>
                    <Button
                      onClick={handleSavePicoPlaca}
                      disabled={!selectedEmpresaId || picoPlacaSaving}
                      className="bg-[#01ADFB] hover:bg-blue-700 text-white font-medium text-[10px] rounded-md gap-1.5 h-8 px-3 shadow-sm shadow-[#01ADFB]/20"
                    >
                      <Save className="h-4 w-4" />
                      {picoPlacaSaving ? "Guardando..." : "Guardar Reglas"}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Empresa</Label>
                      <SelectShadcn value={selectedEmpresaId} onValueChange={handlePicoPlacaEmpresaChange}>
                        <SelectTrigger className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10">
                          <SelectValue placeholder="Selecciona una empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {empresas.map((empresa) => (
                            <SelectItem key={empresa.id} value={empresa.id}>
                              {empresa.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectShadcn>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background/80 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                          <Car className="h-4 w-4 text-[#01ADFB]" />
                          Carros
                        </div>
                        <p className="mt-2 text-xs font-medium text-muted-foreground">
                          Se evalúa el último dígito numérico de la placa.
                        </p>
                      </div>
                      <div className="rounded-lg border border-border bg-background/80 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                          <Bike className="h-4 w-4 text-emerald-600" />
                          Motos
                        </div>
                        <p className="mt-2 text-xs font-medium text-muted-foreground">
                          Se evalúa el primer dígito numérico registrado.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <p className="text-xs font-bold leading-relaxed">
                        Esta configuración NO reemplaza la placa del operador: esa placa se administra en Equipo de Trabajo → Usuarios.
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-8">
                  {loading ? (
                    <div className="flex h-60 items-center justify-center flex-col gap-4">
                      <div className="h-10 w-10 border-4 border-[#01ADFB]/20 border-t-[#01ADFB] rounded-full animate-spin" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Cargando pico y placa...</span>
                    </div>
                  ) : !selectedEmpresaId ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <p className="text-sm font-medium text-foreground">No hay empresa seleccionada</p>
                      <p className="text-xs font-medium text-muted-foreground mt-2">
                        Creá o seleccioná una empresa para configurar restricciones operativas.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {picoPlacaRules.map((rule) => (
                        <div
                          key={rule.dia}
                          className={cn(
                            "grid gap-4 rounded-lg border p-5 transition-all md:grid-cols-[minmax(120px,1fr)_auto_auto]",
                            rule.activo
                              ? "border-[#01ADFB]/30 bg-[#01ADFB]/5"
                              : "border-border bg-muted/30",
                          )}
                        >
                          <label htmlFor={`pico-${rule.dia}`} className="flex items-center gap-3">
                            <input
                              id={`pico-${rule.dia}`}
                              type="checkbox"
                              checked={rule.activo}
                              onChange={(event) => updatePicoPlacaRule(rule.dia, "activo", event.target.checked)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <div>
                              <p className="font-medium text-foreground">{rule.label}</p>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                {rule.activo ? "Restricción activa" : "Sin restricción"}
                              </p>
                            </div>
                          </label>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Dígito 1</Label>
                            <Select
                              value={rule.numeroUno}
                              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                                updatePicoPlacaRule(rule.dia, "numeroUno", event.target.value)
                              }
                              disabled={!rule.activo}
                              className="h-11 min-w-24 rounded-md border-border bg-background text-foreground font-medium"
                            >
                              {DIGITOS_PICO_PLACA.map((digit) => (
                                <option key={`${rule.dia}-uno-${digit}`} value={digit}>
                                  {digit}
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Dígito 2</Label>
                            <Select
                              value={rule.numeroDos}
                              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                                updatePicoPlacaRule(rule.dia, "numeroDos", event.target.value)
                              }
                              disabled={!rule.activo}
                              className="h-11 min-w-24 rounded-md border-border bg-background text-foreground font-medium"
                            >
                              {DIGITOS_PICO_PLACA.map((digit) => (
                                <option key={`${rule.dia}-dos-${digit}`} value={digit}>
                                  {digit}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : activeTab === 'servicios' ? (
              <Card className="border-border bg-card shadow-sm rounded-lg overflow-hidden">
                <CardHeader className="flex flex-col gap-4 px-5 py-4 border-b border-border bg-card">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Servicios</CardTitle>
                      <CardDescription className="mt-1 text-[11px] font-medium text-muted-foreground">
                        Configura cuáles servicios obligan seguimiento y en qué plazos
                      </CardDescription>
                    </div>
                    <Button onClick={() => handleOpenServicioModal()} className="bg-[#01ADFB] hover:bg-blue-700 text-white font-medium text-[10px] rounded-md gap-1.5 h-8 px-3 shadow-sm shadow-[#01ADFB]/20">
                      <Plus className="h-4 w-4" /> AGREGAR SERVICIO
                    </Button>
                  </div>

                  <div className="max-w-sm space-y-2">
                    <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">FILTRAR POR EMPRESA</Label>
                    <SelectShadcn
                      value={selectedEmpresaId}
                      onValueChange={(empresaId) => {
                        setSelectedEmpresaId(empresaId);
                        setLoading(true);
                        configClient.getServicios(empresaId)
                          .then((result) => {
                            setServicios(Array.isArray(result) ? (result as ServicioConfig[]) : []);
                          })
                          .catch(() => {
                            toast.error("Error al cargar los servicios de la empresa");
                          })
                          .finally(() => setLoading(false));
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10">
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id}>
                            {empresa.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectShadcn>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  {loading ? (
                    <div className="flex h-60 items-center justify-center flex-col gap-4">
                      <div className="h-10 w-10 border-4 border-[#01ADFB]/20 border-t-[#01ADFB] rounded-full animate-spin" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Cargando servicios...</span>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {servicios.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 p-6 bg-muted/30 rounded-lg border border-border hover:border-[#01ADFB]/30 transition-all group">
                          <div className="flex gap-4 items-start">
                            <div className="h-12 w-12 rounded-md bg-background border border-border flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                              <Briefcase className="h-6 w-6 text-[#01ADFB]" />
                            </div>
                            <div className="space-y-2">
                              <div>
                                <h4 className="font-medium text-foreground">{item.nombre}</h4>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                  {item.requiereSeguimiento
                                    ? `Seguimiento inicial a ${item.primerSeguimientoDias ?? "-"} días`
                                    : "Sin seguimiento obligatorio"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-widest",
                                  item.requiereSeguimiento
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-zinc-200 text-zinc-600",
                                )}>
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  {item.requiereSeguimiento ? "Con seguimiento" : "Sin seguimiento"}
                                </span>
                                {item.requiereSeguimientoTresMeses ? (
                                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-widest bg-emerald-100 text-emerald-700">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Seguimiento 3 meses
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenServicioModal(item)} className="h-11 w-11 rounded-md hover:bg-background border border-transparent hover:border-border transition-all">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                      {!servicios.length ? (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center">
                          <p className="text-sm font-medium text-foreground">No hay servicios configurados para esta empresa</p>
                          <p className="text-xs font-medium text-muted-foreground mt-2">
                            Crea uno y define si debe obligar seguimiento telefónico.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card shadow-sm rounded-lg overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between px-5 py-4 border-b border-border bg-card">
                  <div>
                    <CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Intereses</CardTitle>
                    <CardDescription className="mt-1 text-[11px] font-medium text-muted-foreground">Gestiona los parámetros operativos</CardDescription>
                  </div>
                  <Button onClick={() => handleOpenModal()} className="bg-[#01ADFB] hover:bg-blue-700 text-white font-medium text-[10px] rounded-md gap-1.5 h-8 px-3 shadow-sm shadow-[#01ADFB]/20"><Plus className="h-4 w-4" /> AGREGAR NUEVO</Button>
                </CardHeader>
                <CardContent className="p-8">
                  {loading ? (
                    <div className="flex h-60 items-center justify-center flex-col gap-4">
                      <div className="h-10 w-10 border-4 border-[#01ADFB]/20 border-t-[#01ADFB] rounded-full animate-spin" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Cargando...</span>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {intereses.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-6 bg-muted/30 rounded-lg border border-border hover:border-[#01ADFB]/30 transition-all group">
                          <div className="flex gap-4 items-center">
                            <div className="h-12 w-12 rounded-md bg-background border border-border flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"><Zap className="h-6 w-6 text-[#01ADFB]" /></div>
                            <div><h4 className="font-medium text-foreground">{item.nombre}</h4><p className="text-xs text-muted-foreground font-medium mt-0.5">{item.descripcion || "Sin descripción"}</p></div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)} className="h-11 w-11 rounded-md hover:bg-background border border-transparent hover:border-border transition-all"><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg bg-card border-border shadow-2xl animate-in zoom-in duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
              <div><CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground uppercase">{editingServicio ? "Editar Servicio" : editingItem ? 'Editar' : 'Agregar'} Parámetro</CardTitle></div>
              <Button variant="ghost" size="icon" onClick={handleCloseModal} className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></Button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Nombre</Label><Input name="nombre" defaultValue={editingServicio?.nombre || editingItem?.nombre} required className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" /></div>
                {activeTab === "intereses" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Frecuencia (Días)</Label><Input type="number" name="frecuenciaSugerida" defaultValue={editingItem?.frecuenciaSugerida} className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Riesgo</Label><Select name="riesgoSugerido" defaultValue={editingItem?.riesgoSugerido || 'BAJO'} className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10"><option value="BAJO">BAJO</option><option value="MEDIO">MEDIO</option><option value="ALTO">ALTO</option><option value="CRITICO">CRÍTICO</option></Select></div>
                  </div>
                )}
                {activeTab === "servicios" && (
                  <div className="space-y-5">
                    <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <input
                          id="requiereSeguimiento"
                          name="requiereSeguimiento"
                          type="checkbox"
                          defaultChecked={editingServicio?.requiereSeguimiento ?? false}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="requiereSeguimiento" className="text-[11px] font-medium uppercase text-foreground">
                            Requiere seguimiento obligatorio
                          </Label>
                          <p className="text-xs text-muted-foreground font-medium">
                            Si se activa, este servicio puede bloquear la creación de nuevas órdenes cuando el asesor no haga la llamada pendiente.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Primer seguimiento (8 a 15 días)</Label>
                        <Input
                          type="number"
                          min={8}
                          max={15}
                          name="primerSeguimientoDias"
                          defaultValue={editingServicio?.primerSeguimientoDias ?? 8}
                          className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-5">
                      <div className="flex items-start gap-3">
                        <input
                          id="requiereSeguimientoTresMeses"
                          name="requiereSeguimientoTresMeses"
                          type="checkbox"
                          defaultChecked={editingServicio?.requiereSeguimientoTresMeses ?? true}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="requiereSeguimientoTresMeses" className="text-[11px] font-medium uppercase text-foreground">
                            Agregar seguimiento de 3 meses
                          </Label>
                          <p className="text-xs text-muted-foreground font-medium">
                            Úsalo para servicios sin contrato que también deben tener revisión posterior a largo plazo.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-5">
                      <div className="flex items-start gap-3">
                        <input
                          id="activo"
                          name="activo"
                          type="checkbox"
                          defaultChecked={editingServicio?.activo ?? true}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="activo" className="text-[11px] font-medium uppercase text-foreground">
                            Servicio activo
                          </Label>
                          <p className="text-xs text-muted-foreground font-medium">
                            Si se desactiva, el servicio deja de aparecer como opción activa para nuevas configuraciones.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-8 pt-0 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={handleCloseModal} className="font-bold text-xs uppercase text-muted-foreground">Cancelar</Button><Button type="submit" className="bg-[#01ADFB] hover:bg-blue-700 text-white font-medium text-[10px] h-8 px-3 rounded-md shadow-sm shadow-[#01ADFB]/20">Guardar Cambios</Button></CardFooter>
            </form>
          </Card>
        </div>
      )}

      <Dialog open={isServicioModalOpen} onOpenChange={(open) => {
        setIsServicioModalOpen(open);
        if (!open) {
          setEditingServicio(null);
        }
      }}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground uppercase">
              {editingServicio ? "Editar Servicio" : "Agregar Servicio"}
            </DialogTitle>
            <DialogDescription className="font-bold text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Configura si este servicio requiere seguimiento y en qué plazos.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Nombre</Label>
              <Input
                name="nombre"
                defaultValue={editingServicio?.nombre || ""}
                required
                className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10"
              />
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    id="servicio-requiereSeguimiento"
                    name="requiereSeguimiento"
                    type="checkbox"
                    defaultChecked={editingServicio?.requiereSeguimiento ?? false}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="servicio-requiereSeguimiento" className="text-[11px] font-medium uppercase text-foreground">
                      Requiere seguimiento obligatorio
                    </Label>
                    <p className="text-xs text-muted-foreground font-medium">
                      Si se activa, este servicio obliga llamada posterior y puede bloquear nuevas asignaciones.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Primer seguimiento (8 a 15 días)</Label>
                  <Input
                    type="number"
                    min={8}
                    max={15}
                    name="primerSeguimientoDias"
                    defaultValue={editingServicio?.primerSeguimientoDias ?? 8}
                    className="h-9 rounded-md border-border/80 bg-background px-3 text-[12px] font-medium text-foreground shadow-none transition-colors focus-visible:border-[#01ADFB] focus-visible:ring-2 focus-visible:ring-[#01ADFB]/10"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-5">
                <div className="flex items-start gap-3">
                  <input
                    id="servicio-requiereSeguimientoTresMeses"
                    name="requiereSeguimientoTresMeses"
                    type="checkbox"
                    defaultChecked={editingServicio?.requiereSeguimientoTresMeses ?? true}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="servicio-requiereSeguimientoTresMeses" className="text-[11px] font-medium uppercase text-foreground">
                      Agregar seguimiento de 3 meses
                    </Label>
                    <p className="text-xs text-muted-foreground font-medium">
                      Úsalo para servicios sin contrato que también requieren revisión posterior.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-5">
                <div className="flex items-start gap-3">
                  <input
                    id="servicio-activo"
                    name="activo"
                    type="checkbox"
                    defaultChecked={editingServicio?.activo ?? true}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="servicio-activo" className="text-[11px] font-medium uppercase text-foreground">
                      Servicio activo
                    </Label>
                    <p className="text-xs text-muted-foreground font-medium">
                      Si se desactiva, deja de aparecer para nuevas órdenes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleCloseModal} className="font-bold text-xs uppercase text-muted-foreground">
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#01ADFB] hover:bg-blue-700 text-white font-medium text-[10px] h-8 px-3 rounded-md shadow-sm shadow-[#01ADFB]/20">
                Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}


