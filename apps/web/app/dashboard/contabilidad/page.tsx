"use client";

import React, { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button
} from "@/components/ui";
import {
  Wallet,
  Users,
  Coins,
  ArrowUpCircle,
  BellRing,
  Scale,
  Plus,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { toast } from "sonner";
import { authClient } from "@/lib/api/auth-client";
import { getBrowserCookie } from "@/lib/api/browser-client";
import { contabilidadClient } from "@/lib/api/contabilidad-client";
import { resolveScopedEmpresaId } from "@/lib/access-scope";
import { getBrowserAccessScope } from "@/lib/browser-access-scope";
import { tenantsClient } from "@/lib/api/tenants-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, DatePicker } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select-shadcn";
import {
  type PaginationMeta,
  type TechnicianRecaudo,
  type RegistrarConsignacionPayload
} from "@/lib/api/contabilidad-client";
import {
  createSignedUploadUrl,
  uploadToSupabaseSignedUrl,
} from "../servicios/api";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es as _es } from "date-fns/locale";
import { CheckCircle, Loader2, FileUp, AlertCircle } from "lucide-react";
import {
  formatBogotaDate,
  pickerDateToYmd,
  toBogotaYmd,
  ymdToPickerDate,
} from "@/utils/date-utils";

type AccountingTab = "recaudo" | "nomina" | "anticipos" | "egresos" | "balance";

const accountingPanelClass =
  "rounded-lg border border-border bg-card shadow-sm";
const accountingPrimaryButtonClass =
  "rounded-md border-none bg-[#01ADFB] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-blue-700";
const accountingSecondaryButtonClass =
  "rounded-md border-border bg-card text-foreground shadow-sm hover:bg-muted";
const accountingModalControlClass =
  "rounded-md border-border bg-background font-sans text-[12px] font-medium tracking-[0.01em] !text-foreground placeholder:text-muted-foreground";
const accountingModalInputClass = cn("h-10", accountingModalControlClass);
const accountingModalTextareaClass = cn(
  "min-h-[96px] w-full border p-3 outline-none transition-all focus:ring-2 focus:ring-[#01ADFB]/20",
  accountingModalControlClass,
);

const ENTERPRISE_SELECTION_MESSAGE =
  "Seleccioná una empresa para registrar el recaudo.";
const ACCOUNTING_TABLE_PAGE_SIZE = 10;
const ACCOUNTING_CATEGORY_PAGE_SIZE = 6;

function AccountingPagination({
  meta,
  itemLabel,
  onPageChange,
}: {
  meta: PaginationMeta | null;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (!meta || meta.total === 0) return null;

  const startItem = (meta.page - 1) * meta.pageSize + 1;
  const endItem = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Mostrando{" "}
        <span className="text-foreground">
          {startItem}-{endItem}
        </span>{" "}
        de <span className="text-foreground">{meta.total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border bg-card px-3 text-[10px] font-medium text-muted-foreground hover:bg-muted"
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
          disabled={!meta.hasPreviousPage}
          aria-label="Ver anteriores"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </Button>
        <span className="min-w-14 rounded-md border border-border bg-muted px-3 py-2 text-center text-[10px] font-medium text-foreground">
          {meta.page}/{meta.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border bg-card px-3 text-[10px] font-medium text-muted-foreground hover:bg-muted"
          onClick={() => onPageChange(Math.min(meta.totalPages, meta.page + 1))}
          disabled={!meta.hasNextPage}
          aria-label="Ver siguientes"
        >
          Siguiente
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function parseMoneyInput(value: string): number {
  if (!value.trim()) return 0;

  const cleaned = value.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : (cleaned.match(/\./g) || []).length > 1
      ? cleaned.replace(/\./g, "")
      : cleaned;
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-CO");
}

function resolveAccountingEmpresaId(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const scope = getBrowserAccessScope();
  const preferredEmpresaId =
    localStorage.getItem("current-enterprise-id") ||
    getBrowserCookie("x-enterprise-id") ||
    undefined;

  if (scope.isEmpresaLocked) {
    return resolveScopedEmpresaId(scope, preferredEmpresaId);
  }

  if (preferredEmpresaId) {
    return preferredEmpresaId;
  }

  if (scope.empresaId) {
    return scope.empresaId;
  }

  return scope.empresaIds.length === 1 ? scope.empresaIds[0] : undefined;
}

export default function ContabilidadPage() {
  const [activeTab, setActiveTab] = useState<AccountingTab>("balance");

  // Sync tab with URL Hash (Read)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "") as AccountingTab;
      if (["recaudo", "nomina", "anticipos", "egresos", "balance"].includes(hash)) {
        setActiveTab(hash);
      }
    };

    handleHashChange(); // Initial load
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Sync state to URL Hash (Write)
  useEffect(() => {
    if (window.location.hash.replace("#", "") !== activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  const handleTabChange = (tabId: AccountingTab) => {
    setActiveTab(tabId);
  };

  const tabs = [
    {
      id: "recaudo",
      label: "Recaudo efectivo",
      icon: Wallet,
      iconClass: "text-[#01ADFB]",
      activeClass: "border-[#01ADFB] text-foreground",
    },
    {
      id: "nomina",
      label: "Nómina",
      icon: Users,
      iconClass: "text-[#01ADFB]",
      activeClass: "border-[#01ADFB] text-foreground",
    },
    {
      id: "anticipos",
      label: "Anticipos",
      icon: Coins,
      iconClass: "text-[#01ADFB]",
      activeClass: "border-[#01ADFB] text-foreground",
    },
    {
      id: "egresos",
      label: "Egresos",
      icon: ArrowUpCircle,
      iconClass: "text-[#01ADFB]",
      activeClass: "border-[#01ADFB] text-foreground",
    },
    {
      id: "balance",
      label: "Balance",
      icon: Scale,
      iconClass: "text-[#01ADFB]",
      activeClass: "border-[#01ADFB] text-foreground",
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "recaudo":
        return <section id="recaudo"><RecaudoView key="recaudo" /></section>;
      case "nomina":
        return <section id="nomina"><StandardTableView key="nomina" type="nomina" title="Gestión de Nómina" description="Administración de pagos y prestaciones de empleados." /></section>;
      case "anticipos":
        return <section id="anticipos"><StandardTableView key="anticipos" type="anticipos" title="Control de Anticipos" description="Registro de adelantos entregados a personal técnico." /></section>;
      case "egresos":
        return <section id="egresos"><StandardTableView key="egresos" type="egresos" title="Egresos Generales" description="Control de gastos operativos, insumos y mantenimiento." /></section>;
      case "balance":
        return <section id="balance"><BalanceView key="balance" /></section>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout overflowHidden>
      <div className="flex h-full flex-col bg-muted/30 transition-all duration-500">
        <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-[15px] font-medium tracking-tight text-foreground">
                Contabilidad y Finanzas
              </h1>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Control ejecutivo · Recaudos · Anticipos · Egresos · Nómina · Balance
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                Cierre · Operación diaria
              </div>
              <div className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                Vista gerencial
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-b border-border bg-card px-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] gap-0 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as AccountingTab)}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 border-transparent px-5 py-3 text-[12px] font-medium tracking-[0.03em] text-muted-foreground transition-colors hover:text-foreground",
                  activeTab === tab.id && tab.activeClass
                )}
              >
                <tab.icon className={cn("h-3.5 w-3.5", activeTab === tab.id ? tab.iconClass : "text-muted-foreground")} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col">
            <div className="animate-in fade-in duration-300">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { exportToExcel, exportToPDF, exportToWord } from "@/lib/utils/export-helper";

// --- sub-views ---

interface Movement {
  id: string;
  createdAt?: string;
  fechaGeneracion?: string;
  monto?: number;
  totalPagar?: number;
  titulo?: string;
  razon?: string;
  membership?: { user: { nombre: string; apellido: string } };
  estado?: string;
  categoria?: string;
}

interface Membership {
  id: string;
  role: string;
  user: {
    nombre: string;
    apellido: string;
  };
}

interface StoredAccountingUser {
  tenantId?: string;
  membershipId?: string;
  nombre?: string;
  apellido?: string;
}

function StandardTableView({ title, description, type }: { title: string, description: string, type: 'egresos' | 'nomina' | 'anticipos' }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [data, setData] = useState<unknown[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<Membership[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [currentMembershipId, setCurrentMembershipId] = useState<string | null>(null);
  const [currentResponsibleName, setCurrentResponsibleName] = useState("Responsable de la sesión");

  const getCategoryColor = (cat: string) => {
    const category = (cat || "GENERAL").toUpperCase();
    switch (category) {
      case "INSUMOS":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "MARKETING":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "OPERATIVO":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "SERVICIOS_PUBLICOS":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-600 border-zinc-500/20";
    }
  };

  const [formData, setFormData] = useState({
    titulo: "",
    monto: "",
    razon: "",
    categoria: "GENERAL",
    membershipId: "none",
    fechaAnticipo: toBogotaYmd(),
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = localStorage.getItem("current-enterprise-id") || undefined;
      let result: unknown[] = [];
      let meta: PaginationMeta | null = null;
      const pagination = {
        page: currentPage,
        pageSize: ACCOUNTING_TABLE_PAGE_SIZE,
      };
      if (type === 'egresos') {
        const response = await contabilidadClient.getEgresosPage(empresaId, pagination);
        result = response.items;
        meta = response.meta;
      } else if (type === 'nomina') {
        const response = await contabilidadClient.getNominasPage(empresaId, pagination);
        result = response.items;
        meta = response.meta;
      } else if (type === 'anticipos') {
        const response = await contabilidadClient.getAnticiposPage(empresaId, pagination);
        result = response.items;
        meta = response.meta;
      }
      setData(Array.isArray(result) ? result : []);
      setPaginationMeta(meta);
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
      toast.error(`Error al cargar ${title}`);
    } finally {
      setLoading(false);
    }
  }, [type, title, currentPage]);

  const getDefaultFormData = React.useCallback(() => ({
    titulo: "",
    monto: "",
    razon: "",
    categoria: "GENERAL",
    membershipId: type === "anticipos" ? currentMembershipId ?? "none" : "none",
    fechaAnticipo: toBogotaYmd(),
  }), [currentMembershipId, type]);

  const fetchMembers = React.useCallback(async () => {
    setMembersLoading(true);
    try {
      let storedUser: StoredAccountingUser = {};
      try {
        storedUser = JSON.parse(localStorage.getItem("user") || "{}") as StoredAccountingUser;
      } catch {
        storedUser = {};
      }

      const profile = await authClient.getProfile();
      const profileMembershipId = profile?.membershipId || storedUser.membershipId || null;
      const profileName = [profile?.nombre || storedUser.nombre, profile?.apellido || storedUser.apellido]
        .filter(Boolean)
        .join(" ")
        .trim();
      const tenantId = profile?.tenantId || storedUser.tenantId;

      setCurrentMembershipId(profileMembershipId);
      if (profileName) setCurrentResponsibleName(profileName);

      if (!tenantId) {
        setMembers([]);
        return;
      }

      const res = await tenantsClient.getMemberships(tenantId);
      if (!res || res.length === 0) {
        console.warn("No members found or error in tenantsClient.getMemberships");
      }
      const memberships = res || [];
      const currentMember = profileMembershipId
        ? memberships.find((member) => member.id === profileMembershipId)
        : undefined;

      setMembers(memberships);
      if (currentMember?.user) {
        setCurrentResponsibleName(
          `${currentMember.user.nombre} ${currentMember.user.apellido}`.trim(),
        );
      }

      if (type === 'anticipos' && profileMembershipId) {
        setFormData((prev) => ({
          ...prev,
          membershipId: profileMembershipId,
        }));
      }
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Error al cargar la lista de responsables");
    } finally {
      setMembersLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchData();
    if (type === 'egresos' || type === 'anticipos') fetchMembers();
  }, [type, fetchData, fetchMembers]);

  const handleOpenCreateModal = React.useCallback(() => {
    setFormData(getDefaultFormData());
    setIsModalOpen(true);
    if ((type === 'egresos' || type === 'anticipos') && members.length === 0) {
      void fetchMembers();
    }
  }, [fetchMembers, getDefaultFormData, members.length, type]);

  const accountingItemLabel =
    type === 'nomina' ? "pagos" : type === 'anticipos' ? "anticipos" : "egresos";
  const parsedFormAmount = Number(formData.monto);
  const isCreateDisabled =
    isSaving ||
    (type === 'egresos' && !formData.titulo.trim()) ||
    !Number.isFinite(parsedFormAmount) ||
    parsedFormAmount <= 0 ||
    (type === 'anticipos' &&
      (formData.membershipId === 'none' || !formData.fechaAnticipo));

  const handleCreateRecord = async () => {
    const amount = Number(formData.monto);
    const hasInvalidAmount = !Number.isFinite(amount) || amount <= 0;

    if (
      (type === 'egresos' && !formData.titulo.trim()) ||
      hasInvalidAmount ||
      (type === 'anticipos' && (formData.membershipId === 'none' || !formData.fechaAnticipo))
    ) {
      toast.error("Complete los campos obligatorios");
      return;
    }

    setIsSaving(true);
    try {
      const empresaId = localStorage.getItem("current-enterprise-id");
      if (!empresaId) throw new Error("No enterprise selected");

      if (type === 'egresos') {
        await contabilidadClient.crearEgreso({
          titulo: formData.titulo,
          monto: amount,
          razon: formData.razon,
          categoria: formData.categoria,
          membershipId: formData.membershipId === 'none' ? undefined : formData.membershipId,
          empresaId,
        });
        toast.success("Egreso registrado exitosamente");
        setIsModalOpen(false);
        setFormData(getDefaultFormData());
        if (currentPage === 1) fetchData();
        else setCurrentPage(1);
      } else if (type === 'anticipos') {
        await contabilidadClient.crearAnticipo({
          monto: amount,
          razon: formData.razon || "Anticipo de personal",
          empresaId,
          fechaAnticipo: formData.fechaAnticipo,
        });
        toast.success("Anticipo registrado exitosamente");
        setIsModalOpen(false);
        setFormData(getDefaultFormData());
        if (currentPage === 1) fetchData();
        else setCurrentPage(1);
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Error al procesar el registro");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (formatType: 'pdf' | 'excel' | 'word') => {
    const headers = [
      "Fecha",
      "Descripción",
      ...(type === 'egresos' ? ["Categoría"] : []),
      "Responsable",
      "Monto",
      "Estado"
    ];

    const exportData = data.map(d => {
      const item = d as Movement;
      const fecha = item.createdAt || item.fechaGeneracion || new Date();
      const monto = item.monto || item.totalPagar || 0;
      const desc = item.titulo || item.razon || `Registro #${item.id.slice(0, 8)}`;
      const resp = item.membership?.user ? `${item.membership.user.nombre} ${item.membership.user.apellido}` : "N/A";
      const est = item.estado || "Completado";

      return [
        format(new Date(fecha), "dd/MM/yyyy"),
        desc,
        ...(type === 'egresos' ? [item.categoria || "GENERAL"] : []),
        resp,
        `$ ${Number(monto).toLocaleString()}`,
        est
      ];
    });

    const exportParams = {
      headers,
      data: exportData,
      filename: `contabilidad_${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().getTime()}`,
      title: `REPORTE FINANCIERO: ${title.toUpperCase()}`
    };

    toast.info(`Generando reporte de ${title} en formato ${formatType.toUpperCase()}...`);

    try {
      if (formatType === 'excel') exportToExcel(exportParams);
      else if (formatType === 'pdf') exportToPDF(exportParams);
      else if (formatType === 'word') await exportToWord(exportParams);

      toast.success(`${formatType.toUpperCase()} generado exitosamente`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Error al generar el reporte ${formatType.toUpperCase()}`);
    } finally {
      setShowExportMenu(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">{title}</h2>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex h-8 items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 text-[10px] font-medium tracking-[0.03em] text-emerald-600 shadow-sm transition-all hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card py-2 shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="mb-1 border-b border-border px-4 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Informes financieros</p>
                </div>
                <button
                  onClick={() => handleExport('excel')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  MICROSOFT EXCEL (.XLSX)
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <FileText className="h-4 w-4" />
                  DOCUMENTO PDF (.PDF)
                </button>
                <button
                  onClick={() => handleExport('word')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <FileIcon className="h-4 w-4" />
                  MICROSOFT WORD (.DOCX)
                </button>
              </div>
            )}
          </div>

          <Button onClick={fetchData} variant="outline" className={cn("h-8 gap-2 px-3 text-[10px] font-medium tracking-[0.03em]", accountingSecondaryButtonClass)}>
            <Loader2 className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refrescar
          </Button>
          <Button
            onClick={handleOpenCreateModal}
            className={cn("h-8 gap-2 px-3 text-[10px] font-medium tracking-[0.03em]", accountingPrimaryButtonClass)}
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo registro
          </Button>
        </div>
      </div>

      <Card className={cn(accountingPanelClass, "overflow-hidden")}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Fecha</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Descripción</th>
                  {type === 'egresos' && (
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Categoría</th>
                  )}
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Responsable</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Monto</th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                       <td colSpan={type === 'egresos' ? 6 : 5} className="h-12 bg-muted/20 px-4 py-3"></td>
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={type === 'egresos' ? 6 : 5} className="px-4 py-16 text-center">
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">No hay registros encontrados.</p>
                    </td>
                  </tr>
                ) : (
                  data.map((d) => {
                    const item = d as Movement;
                    const fecha = item.createdAt || item.fechaGeneracion || new Date();
                    const monto = item.monto || item.totalPagar || 0;
                    const desc = item.titulo || item.razon || `ID: ${item.id.slice(0, 8)}`;
                    const resp = item.membership?.user ? `${item.membership.user.nombre} ${item.membership.user.apellido}` : "N/A";
                    const est = item.estado || "Completado";
                    const isPending = est === 'BORRADOR' || est === 'PENDIENTE';

                    return (
                      <tr key={item.id} className="group transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 text-[11px] font-medium text-muted-foreground">
                          {format(new Date(fecha), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-foreground">
                          {desc}
                        </td>
                        {type === 'egresos' && (
                          <td className="px-4 py-3">
                            <span className={cn(
                              "rounded px-2 py-1 text-[10px] font-medium uppercase tracking-[0.04em] border",
                              getCategoryColor(item.categoria || "GENERAL")
                            )}>
                              {item.categoria || "GENERAL"}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className="rounded border border-border bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                            {resp}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums text-foreground">
                          $ {Number(monto).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn(
                            "inline-flex items-center gap-2 text-[11px] font-medium",
                            isPending ? "text-amber-600" : "text-emerald-600"
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", isPending ? "bg-amber-500" : "bg-emerald-500")} />
                            <span>{est}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <AccountingPagination
            meta={paginationMeta}
            itemLabel={accountingItemLabel}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden border-border bg-card p-0 font-sans shadow-xl">
          <DialogHeader className="border-b border-border bg-card px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-[#01ADFB]/20 bg-[#01ADFB]/10">
                <Plus className="h-4 w-4 text-[#01ADFB]" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">
                  Nuevo registro · {title}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground">
                  {type === 'anticipos'
                    ? "Registrá el valor, la fecha y el concepto del anticipo."
                    : "Completá la información del movimiento financiero."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 custom-scrollbar">
            {type === 'anticipos' && (
              <div
                className={cn(
                  "rounded-lg border px-4 py-3",
                  formData.membershipId === "none"
                    ? "border-amber-500/25 bg-amber-500/10"
                    : "border-border bg-muted/30",
                )}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Responsable
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {membersLoading
                        ? "Cargando responsable..."
                        : formData.membershipId === "none"
                          ? "No se pudo identificar el responsable"
                          : currentResponsibleName}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                      Se registra con el responsable de la sesión.
                    </p>
                  </div>
                  {membersLoading && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#01ADFB]" />
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {type === 'egresos' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Título / concepto <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ej: Pago de arriendo"
                    className={accountingModalInputClass}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Monto <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                  placeholder="0"
                  className={accountingModalInputClass}
                />
              </div>

              {type === 'anticipos' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Fecha del anticipo <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    date={formData.fechaAnticipo ? ymdToPickerDate(formData.fechaAnticipo) : undefined}
                    onChange={(date) =>
                      setFormData({
                        ...formData,
                        fechaAnticipo: pickerDateToYmd(date),
                      })
                    }
                    className={cn(accountingModalInputClass, "w-full normal-case")}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {type === 'egresos' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Categoría
                  </Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(val) => setFormData({ ...formData, categoria: val })}
                  >
                    <SelectTrigger className={accountingModalInputClass}>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">General</SelectItem>
                      <SelectItem value="INSUMOS">Insumos</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="OPERATIVO">Operativo</SelectItem>
                      <SelectItem value="SERVICIOS_PUBLICOS">Servicios Públicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {type === 'egresos' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Responsable
                  </Label>
                  <Select
                    value={formData.membershipId}
                    onValueChange={(val) => setFormData({ ...formData, membershipId: val })}
                    disabled={membersLoading}
                  >
                    <SelectTrigger className={accountingModalInputClass}>
                      <SelectValue placeholder={membersLoading ? "Cargando responsables..." : "Seleccionar responsable"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.user.nombre} {member.user.apellido} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {type === 'egresos' ? "Descripción o razón" : "Concepto del anticipo"}
              </Label>
              <textarea
                value={formData.razon}
                onChange={(e) => setFormData({ ...formData, razon: e.target.value })}
                className={accountingModalTextareaClass}
                placeholder={type === 'egresos' ? "Detalles adicionales del gasto..." : "Ej: Viáticos para comisión"}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className={cn("h-10 px-5 text-[10px] font-medium uppercase tracking-[0.14em]", accountingSecondaryButtonClass)}
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              className={cn("h-10 px-5 text-[10px] font-medium uppercase tracking-[0.14em]", accountingPrimaryButtonClass)}
              onClick={handleCreateRecord}
              disabled={isCreateDisabled}
            >
              {isSaving ? "Guardando..." : type === 'anticipos' ? "Registrar anticipo" : "Registrar movimiento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



function RecaudoView() {
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<TechnicianRecaudo[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTech, setSelectedTech] = useState<TechnicianRecaudo | null>(null);
  const [selectedOrdenIds, setSelectedOrdenIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [remindingTechId, setRemindingTechId] = useState<string | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [empresaMessage, setEmpresaMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    referenciaBanco: "",
    fechaConsignacion: toBogotaYmd(),
    valorAdelanto: "",
    observacion: "",
    confirmarEfectivoFisico: false,
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = resolveAccountingEmpresaId();
      setEmpresaMessage(empresaId ? null : ENTERPRISE_SELECTION_MESSAGE);
      const response = await contabilidadClient.getRecaudoTecnicosPage(empresaId, {
        page: currentPage,
        pageSize: ACCOUNTING_TABLE_PAGE_SIZE,
      });
      setTechnicians(Array.isArray(response.items) ? response.items : []);
      setPaginationMeta(response.meta);
    } catch (error) {
      console.error("Error loading recaudo data:", error);
      toast.error("Error al cargar datos de recaudo");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (tech: TechnicianRecaudo) => {
    setSelectedTech(tech);
    setSelectedOrdenIds([]); // Selección explícita: nada queda marcado por defecto
    setComprobanteFile(null);
    setFormData({
      referenciaBanco: "",
      fechaConsignacion: toBogotaYmd(),
      valorAdelanto: "",
      observacion: "",
      confirmarEfectivoFisico: false,
    });
    setIsModalOpen(true);
  };

  const toggleOrdenSelection = (id: string) => {
    setSelectedOrdenIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalSeleccionado = useMemo(() => {
    if (!selectedTech) return 0;
    return selectedTech.declaraciones
      .filter(d => selectedOrdenIds.includes(d.ordenId))
      .reduce((sum, d) => sum + d.valorDeclarado, 0);
  }, [selectedTech, selectedOrdenIds]);

  const valorAdelanto = useMemo(
    () => Math.max(0, parseMoneyInput(formData.valorAdelanto)),
    [formData.valorAdelanto],
  );

  const valorEntregado = useMemo(
    () => Math.max(totalSeleccionado - valorAdelanto, 0),
    [totalSeleccionado, valorAdelanto],
  );

  const adelantoInvalido = valorAdelanto > totalSeleccionado;

  const selectedDeclaraciones = useMemo(() => {
    if (!selectedTech) return [];
    return selectedTech.declaraciones.filter(d => selectedOrdenIds.includes(d.ordenId));
  }, [selectedTech, selectedOrdenIds]);

  const handleSendLiquidationReminder = async (tech: TechnicianRecaudo) => {
    if (tech.saldoPendiente <= 0) {
      toast.info("Ese operador ya está al día.");
      return;
    }

    setRemindingTechId(tech.id);

    try {
      const empresaId = resolveAccountingEmpresaId();
      const result = await contabilidadClient.enviarRecordatorioLiquidacion(
        tech.id,
        empresaId,
      );

      toast.success(
        result.message ||
          `Recordatorio enviado a ${tech.nombre} ${tech.apellido}.`,
      );
    } catch (error) {
      console.error("Error sending liquidation reminder:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el recordatorio de liquidación",
      );
    } finally {
      setRemindingTechId(null);
    }
  };

  const handleRegisterConsignacion = async () => {
    if (!selectedTech || !formData.referenciaBanco || !comprobanteFile) {
      toast.error("Por favor complete los campos obligatorios");
      return;
    }

    if (selectedOrdenIds.length === 0) {
      toast.error("Debe seleccionar al menos una orden para conciliar");
      return;
    }

    if (!formData.confirmarEfectivoFisico) {
      toast.error("Confirmá que esto fue efectivo físico. Si fue transferencia del cliente, no uses Recaudo Efectivo.");
      return;
    }

    if (adelantoInvalido) {
      toast.error("El adelanto no puede superar el total seleccionado");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Subiendo soporte y procesando conciliación...");

    try {
      const empresaId = resolveAccountingEmpresaId();
      if (!empresaId) {
        setEmpresaMessage(ENTERPRISE_SELECTION_MESSAGE);
        toast.error(ENTERPRISE_SELECTION_MESSAGE, { id: toastId });
        setIsSaving(false);
        return;
      }

      // 1. Subir el soporte de consignación sin mutar la orden antes de conciliar
      // Usamos la primera orden de la lista como referencia para el ID si el helper pide uno
      const referenceOrdenId = selectedOrdenIds[0];
      const signed = await createSignedUploadUrl(referenceOrdenId, "consignacionTecnico", comprobanteFile.name);
      await uploadToSupabaseSignedUrl(signed.path, signed.token, comprobanteFile);

      // 2. Registrar la consignación en el backend mandando la RUTA del archivo
      const valorConsignadoLegacy = totalSeleccionado; // Legacy: el backend recalcula y valida el total real

      const consignacionPayload: RegistrarConsignacionPayload = {
        tecnicoId: selectedTech.id,
        empresaId: empresaId,
        valorConsignado: valorConsignadoLegacy,
        valorEntregado,
        valorAdelanto,
        referenciaBanco: formData.referenciaBanco,
        ordenIds: selectedOrdenIds,
        fechaConsignacion: formData.fechaConsignacion,
        observacion: formData.observacion || undefined,
        comprobantePath: signed.path, // Mandamos la ruta relativa
        confirmarEfectivoFisico: formData.confirmarEfectivoFisico,
      };

      await contabilidadClient.registrarConsignacion(consignacionPayload);

      toast.success("Consignación registrada y conciliada exitosamente", { id: toastId });
      setIsModalOpen(false);
      if (currentPage === 1) fetchData();
      else setCurrentPage(1);
    } catch (error) {
      console.error("Consignation error:", error);
      const errorMessage = (() => {
        if (error instanceof Error && error.message.trim()) {
          return error.message;
        }

        if (typeof error === "string" && error.trim()) {
          return error;
        }

        try {
          return JSON.stringify(error);
        } catch {
          return "Error al procesar el registro";
        }
      })();
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Recaudo en efectivo</h2>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">Conciliación de dinero físico entregado por los técnicos.</p>
        </div>
        <Button onClick={fetchData} variant="outline" className={cn("h-8 gap-2 px-3 text-[10px] font-medium tracking-[0.03em]", accountingSecondaryButtonClass)}>
          Refrescar
        </Button>
      </div>

      {empresaMessage && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
          {empresaMessage}
        </div>
      )}

      <Card className={cn(accountingPanelClass, "overflow-hidden")}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b border-border">
                  <TableHead className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Técnico</TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Saldo pendiente</TableHead>
                  <TableHead className="px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Órdenes</TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Última transferencia</TableHead>
                  <TableHead className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Estado</TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [1, 2, 3].map(i => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="px-4 py-10 text-center">
                        <div className="flex justify-center items-center gap-3">
                          <Loader2 className="h-4 w-4 animate-spin text-[#01ADFB]" />
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Cargando balances...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : technicians.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">No hay recaudos pendientes de conciliación.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  technicians.map((tech) => {
                    const hasDebt = tech.saldoPendiente > 0;
                    const isCritical = hasDebt && tech.diasSinTransferir >= 15;
                    const isWarning = hasDebt && tech.diasSinTransferir > 7 && !isCritical;
                    const statusLabel = !hasDebt
                      ? "Al día"
                      : isCritical || isWarning
                        ? `${tech.diasSinTransferir} días atrasado`
                        : `Normal · ${tech.diasSinTransferir} días`;

                    return (
                      <TableRow key={tech.id} className="group transition-colors hover:bg-muted/50">
                        <TableCell className="px-4 py-3 text-xs font-medium text-foreground">
                          {tech.nombre} {tech.apellido}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <span className={cn(
                            "text-[13px] font-medium tabular-nums",
                            isCritical ? "text-destructive" : hasDebt ? "text-foreground" : "text-muted-foreground/40"
                          )}>
                            $ {tech.saldoPendiente.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          {tech.ordenesPendientesCount > 0 ? (
                            <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                              {tech.ordenesPendientesCount} pendientes
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-muted-foreground/40">--</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-[11px] font-medium text-muted-foreground">
                          {tech.ultimaTransferencia
                            ? formatBogotaDate(tech.ultimaTransferencia, "es-CO")
                            : "Primer recaudo"
                          }
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className={cn(
                            "inline-flex items-center gap-2 text-[11px] font-medium",
                            isCritical && "text-destructive",
                            isWarning && "text-amber-600 dark:text-amber-400",
                            !isCritical && !isWarning && "text-muted-foreground"
                          )}>
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isCritical ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                              )}
                            />
                            <span>{statusLabel}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 rounded-md border-border bg-card px-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                              onClick={() => handleSendLiquidationReminder(tech)}
                              disabled={
                                tech.saldoPendiente <= 0 ||
                                remindingTechId === tech.id
                              }
                            >
                              {remindingTechId === tech.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <BellRing className="h-3.5 w-3.5" />
                              )}
                              Recordar
                            </Button>
                            <Button
                              size="sm"
                              className={cn("h-7 px-3 text-[10px] font-medium", accountingPrimaryButtonClass)}
                              onClick={() => handleOpenModal(tech)}
                              disabled={tech.saldoPendiente <= 0}
                            >
                              Conciliar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <AccountingPagination
            meta={paginationMeta}
            itemLabel="técnicos"
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden border-border bg-card p-0 shadow-xl">
          <DialogHeader className="border-b border-border bg-card px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-[#01ADFB]/20 bg-[#01ADFB]/10">
                <Coins className="h-4 w-4 text-[#01ADFB]" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">
                  Conciliación de efectivo
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground">
                  Seleccioná las órdenes y confirmá el cierre de dinero físico entregado por el técnico.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedTech && (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 custom-scrollbar">
                <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Responsable
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {selectedTech.nombre} {selectedTech.apellido}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Monto seleccionado
                    </p>
                    <p className="mt-1 text-xl font-medium tabular-nums text-foreground">
                      $ {formatMoney(totalSeleccionado)}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                      {selectedOrdenIds.length} de {selectedTech.ordenesPendientesCount} órdenes
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-xs font-medium",
                    selectedOrdenIds.length === 0
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {selectedOrdenIds.length === 0 ? (
                    <p>
                      Marcá manualmente las órdenes que vas a conciliar antes de confirmar.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p>
                        Selección actual: {selectedDeclaraciones.length} orden{selectedDeclaraciones.length === 1 ? "" : "es"}.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedDeclaraciones.slice(0, 4).map((d) => (
                          <Badge
                            key={d.ordenId}
                            variant="outline"
                            className="rounded-md border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground"
                          >
                            #{d.ordenId.substring(0, 8).toUpperCase()} · $ {formatMoney(d.valorDeclarado)}
                          </Badge>
                        ))}
                        {selectedDeclaraciones.length > 4 && (
                          <Badge
                            variant="outline"
                            className="rounded-md border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground"
                          >
                            +{selectedDeclaraciones.length - 4} más
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Órdenes pendientes de conciliación
                    </Label>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {selectedDeclaraciones.length} seleccionadas
                    </span>
                  </div>
                  <div className="max-h-52 overflow-hidden overflow-y-auto rounded-lg border border-border bg-card custom-scrollbar">
                    {selectedTech.declaraciones.map((d) => {
                      const isSelected = selectedOrdenIds.includes(d.ordenId);

                      return (
                        <button
                          key={d.ordenId}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50",
                            isSelected && "bg-[#01ADFB]/5",
                          )}
                          onClick={() => toggleOrdenSelection(d.ordenId)}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                                isSelected
                                  ? "border-[#01ADFB] bg-[#01ADFB] text-white"
                                  : "border-border bg-background text-transparent",
                              )}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </span>
                            <span>
                              <span className="block text-xs font-medium text-foreground">
                                Orden #{d.ordenId.substring(0, 8).toUpperCase()}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                                {formatBogotaDate(d.fechaDeclaracion)}
                              </span>
                            </span>
                          </div>
                          <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                            $ {formatMoney(d.valorDeclarado)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Total a conciliar
                    </p>
                    <p className="mt-2 text-lg font-medium tabular-nums text-foreground">
                      $ {formatMoney(totalSeleccionado)}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm">
                    <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Adelanto al técnico
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={totalSeleccionado}
                      step={1000}
                      value={formData.valorAdelanto}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valorAdelanto: e.target.value,
                        })
                      }
                      placeholder="0"
                      className="h-10 rounded-md border-border bg-background text-sm font-medium text-foreground"
                    />
                  </div>

                  <div
                    className={cn(
                      "rounded-lg border p-4 shadow-sm",
                      adelantoInvalido
                        ? "border-destructive/30 bg-destructive/10"
                        : "border-border bg-card",
                    )}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Valor entregado
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-lg font-medium tabular-nums",
                        adelantoInvalido ? "text-destructive" : "text-foreground",
                      )}
                    >
                      $ {formatMoney(valorEntregado)}
                    </p>
                  </div>
                </div>

                {adelantoInvalido && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
                    El adelanto no puede superar el total seleccionado.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Referencia bancaria <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.referenciaBanco}
                      onChange={(e) => setFormData({ ...formData, referenciaBanco: e.target.value })}
                      placeholder="Referencia de consignación"
                      className="h-10 rounded-md border-border bg-background text-sm font-medium text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Fecha de consignación <span className="text-destructive">*</span>
                    </Label>
                    <DatePicker
                      date={formData.fechaConsignacion ? ymdToPickerDate(formData.fechaConsignacion) : undefined}
                      onChange={(d) => setFormData({ ...formData, fechaConsignacion: pickerDateToYmd(d) })}
                      className="h-10 w-full border-border bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Soporte de consignación <span className="text-destructive">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => document.getElementById("comprobante-recaudo-upload")?.click()}
                    className="flex min-h-24 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:bg-muted/50"
                  >
                    <FileUp className="mb-2 h-5 w-5 text-muted-foreground" />
                    <span className="w-full truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {comprobanteFile ? comprobanteFile.name : "Adjuntar soporte de consignación"}
                    </span>
                    <input
                      id="comprobante-recaudo-upload"
                      type="file"
                      className="hidden"
                      onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
                      accept="image/*,application/pdf"
                    />
                  </button>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Observaciones
                  </Label>
                  <textarea
                    value={formData.observacion}
                    onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                    className="min-h-[96px] w-full rounded-lg border border-border bg-background p-3 text-sm font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-[#01ADFB]/20"
                    placeholder="Notas sobre el cierre de caja..."
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-amber-900 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={formData.confirmarEfectivoFisico}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmarEfectivoFisico: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-amber-500 accent-[#01ADFB]"
                  />
                  <span className="text-xs font-medium leading-relaxed">
                    Confirmo que este soporte corresponde a dinero físico recibido por el técnico. Si el cliente pagó por transferencia, no se debe conciliar por recaudo en efectivo.
                  </span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className={cn("h-10 px-5 text-[10px] font-medium uppercase tracking-[0.14em]", accountingSecondaryButtonClass)}
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  className={cn("h-10 px-5 text-[10px] font-medium uppercase tracking-[0.14em]", accountingPrimaryButtonClass)}
                  onClick={handleRegisterConsignacion}
                  disabled={isSaving || !formData.referenciaBanco || !comprobanteFile || selectedOrdenIds.length === 0 || !formData.confirmarEfectivoFisico || adelantoInvalido}
                >
                  {isSaving ? "Procesando..." : "Conciliar efectivo"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BalanceView() {
  const [balance, setBalance] = useState<{
    ingresos: { total: number; change: number };
    egresos: { total: number; change: number };
    utilidad: { total: number; change: number };
    categorias: { label: string; value: number; color: string }[];
    categoriasMeta?: PaginationMeta;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryMeta, setCategoryMeta] = useState<PaginationMeta | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      setLoading(true);
      const empresaId = localStorage.getItem("current-enterprise-id") || undefined;
      const data = await contabilidadClient.getBalance(empresaId, {
        page: categoryPage,
        pageSize: ACCOUNTING_CATEGORY_PAGE_SIZE,
      });
      setBalance(data);
      setCategoryMeta(data?.categoriasMeta ?? null);
      setLoading(false);
    };
    fetchBalance();
  }, [categoryPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className={accountingPanelClass}>
          <CardContent className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <span className={cn(
                "text-[10px] font-black px-2 py-1 rounded-lg",
                (balance?.ingresos.change || 0) >= 0 ? "text-emerald-600 bg-emerald-500/10" : "text-destructive bg-destructive/10"
              )}>
                {(balance?.ingresos.change || 0) >= 0 ? "+" : ""}{balance?.ingresos.change}%
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ingresos Totales</p>
            <h3 className="mt-1 text-3xl font-black tracking-tighter text-foreground">
              $ {balance?.ingresos.total.toLocaleString() || "0"}
            </h3>
          </CardContent>
        </Card>

        <Card className={accountingPanelClass}>
          <CardContent className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <TrendingDown className="h-6 w-6" />
              </div>
              <span className={cn(
                "text-[10px] font-black px-2 py-1 rounded-lg",
                (balance?.egresos.change || 0) <= 0 ? "text-emerald-600 bg-emerald-500/10" : "text-destructive bg-destructive/10"
              )}>
                {(balance?.egresos.change || 0) >= 0 ? "+" : ""}{balance?.egresos.change}%
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Egresos Totales</p>
            <h3 className="mt-1 text-3xl font-black tracking-tighter text-foreground">
              $ {balance?.egresos.total.toLocaleString() || "0"}
            </h3>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-none bg-foreground text-background shadow-sm">
          <CardContent className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/10">
                <DollarSign className="h-6 w-6 text-background" />
              </div>
            </div>
            <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Utilidad Neta</p>
            <h3 className="mt-1 text-3xl font-black tracking-tighter">
              $ {balance?.utilidad.total.toLocaleString() || "0"}
            </h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className={accountingPanelClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-black text-foreground">
              <div className="h-2 w-2 rounded-full bg-[#01ADFB]" />
              Flujo de Caja Mensual
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-64 flex-col justify-end gap-4">
            <div className="flex h-40 items-end gap-3">
              {[48, 64, 42, 36, 78, 52, 60, 44].map((height, index) => (
                <div key={index} className="flex flex-1 items-end rounded-xl bg-muted/60">
                  <div
                    className={cn(
                      "w-full rounded-xl",
                      index === 4 ? "bg-[#01ADFB]" : "bg-muted-foreground/20",
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Resumen mensual de entradas y salidas
            </p>
          </CardContent>
        </Card>

        <Card className={accountingPanelClass}>
          <CardHeader>
            <CardTitle className="text-xl font-black text-foreground">Gastos por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {(balance?.categorias || []).map((cat) => (
              <div key={cat.label} className="space-y-2">
                <div className="flex items-end justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{cat.label}</span>
                  <span className="text-xs font-black text-foreground">{cat.value}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", cat.color)} style={{ width: `${cat.value}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
          <AccountingPagination
            meta={categoryMeta}
            itemLabel="categorías"
            onPageChange={setCategoryPage}
          />
        </Card>
      </div>
    </div>
  );
}
