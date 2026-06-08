"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { cn } from "@/components/ui/utils";
import {
  Package,
  Search,
  History,
  AlertCircle,
  TrendingDown,
  Download,
  Plus,
  Loader2,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  FileIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/base-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { 
  exportMultiToExcel, 
  exportMultiToPDF, 
  exportMultiToWord, 
  type ExportDataset 
} from "@/lib/utils/export-helper";

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "relative overflow-hidden rounded-lg border border-border bg-card shadow-sm",
    className
  )}>
    {children}
  </div>
);

const labelClass = "text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground";
const fieldClass = "h-9 rounded-md border-border bg-background text-xs text-foreground focus-visible:ring-[#01ADFB]/25";
const tableHeadClass = "px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground";
const tableCellClass = "px-4 py-3";
const compactActionButtonClass = "h-8 rounded-md px-3 text-[11px] font-medium";
const INSUMOS_PAGE_SIZE = 10;
const numberFormatter = new Intl.NumberFormat("es-CO");

const formatDisplayNumber = (value: number | string) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numberFormatter.format(numericValue) : String(value);
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

function InsumosPagination({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Mostrando <span className="text-foreground">{startItem}-{endItem}</span> de{" "}
        <span className="text-foreground">{total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border bg-card px-3 text-[10px] font-medium text-muted-foreground hover:bg-muted"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          aria-label="Ver anteriores"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </Button>
        <span className="min-w-14 rounded-md border border-border bg-muted px-3 py-2 text-center text-[10px] font-medium text-foreground">
          {safePage}/{totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-border bg-card px-3 text-[10px] font-medium text-muted-foreground hover:bg-muted"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          aria-label="Ver siguientes"
        >
          Siguiente
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

type InsumosClientProps = {
  initialStock: StockItem[];
  initialSolicitudes: SolicitudItem[];
  proveedores: ProveedorItem[];
  memberships: MembershipItem[];
};

type StockItem = {
  id: string;
  nombre: string;
  categoria?: string | null;
  unidadMedida?: string | null;
  stockActual?: number | null;
  stockMinimo?: number | null;
};

type SolicitudItem = {
  id: string;
  createdAt?: string | Date | null;
  cantidad: number | string;
  unidadMedida?: string | null;
  estado?: string;
  membership?: {
    user?: {
      nombre?: string | null;
      apellido?: string | null;
    } | null;
  } | null;
  producto?: {
    nombre?: string | null;
    categoria?: string | null;
    unidadMedida?: string | null;
  } | null;
};

type ProveedorItem = {
  id: string;
  nombre: string;
};

type MembershipItem = {
  id: string;
  role?: string | null;
  user: {
    nombre: string;
    apellido: string;
  };
};

export function InsumosClient({ initialStock, initialSolicitudes, proveedores, memberships }: InsumosClientProps) {
  const [activeTab, setActiveTab] = useState<"solicitudes" | "stock">("solicitudes");
  const [solSearch, setSolSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [solPage, setSolPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const deferredSolSearch = useDeferredValue(solSearch);
  const deferredStockSearch = useDeferredValue(stockSearch);

  // Modal states
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isSolicitudModalOpen, setIsSolicitudModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Form states
  const [stockForm, setStockForm] = useState({
    nombre: "",
    categoria: "",
    unidadMedida: "",
    stockActual: "",
    stockMinimo: "",
    proveedorId: "",
  });

  const [solicitudForm, setSolicitudForm] = useState({
    productoId: "",
    cantidad: "",
    unidadMedida: "",
    membershipId: "",
  });

  const formattedSolicitudes = useMemo(() => initialSolicitudes.map(sol => ({
    id: sol.id,
    fecha: sol.createdAt ? format(new Date(sol.createdAt), "dd MMM yyyy", { locale: es }) : "N/A",
    tecnico: sol.membership?.user ? `${sol.membership.user.nombre} ${sol.membership.user.apellido}` : "Desconocido",
    producto: sol.producto?.nombre || "Producto desconocido",
    cantidad: sol.cantidad,
    unidad: sol.unidadMedida || sol.producto?.unidadMedida || "",
    estado: sol.estado === "ACEPTADA" ? "Aprobado" : sol.estado === "RECHAZADA" ? "Rechazado" : "Pendiente",
    rawEstado: sol.estado,
  })), [initialSolicitudes]);

  const formattedStock = useMemo(() => initialStock.map(item => {
    const stockActual = item.stockActual || 0;
    const stockMinimo = item.stockMinimo || 0;

    let estado = "Normal";
    if (stockActual === 0) estado = "Agotado";
    else if (stockActual > 0 && stockActual <= stockMinimo * 0.25) estado = "Crítico";
    else if (stockActual > stockMinimo * 0.25 && stockActual <= stockMinimo) estado = "Bajo";

    return {
      id: item.id,
      producto: item.nombre,
      categoria: item.categoria || "General",
      stockActual,
      unidad: item.unidadMedida || "unidades",
      estado,
    };
  }), [initialStock]);

  const filteredSolicitudes = useMemo(() => {
    const search = deferredSolSearch.trim().toLowerCase();
    if (!search) return formattedSolicitudes;

    return formattedSolicitudes.filter(sol =>
      sol.producto.toLowerCase().includes(search) ||
      sol.tecnico.toLowerCase().includes(search)
    );
  }, [deferredSolSearch, formattedSolicitudes]);

  const filteredStock = useMemo(() => {
    const search = deferredStockSearch.trim().toLowerCase();
    if (!search) return formattedStock;

    return formattedStock.filter(item =>
      item.producto.toLowerCase().includes(search) ||
      item.categoria.toLowerCase().includes(search)
    );
  }, [deferredStockSearch, formattedStock]);

  const visibleSolicitudes = useMemo(
    () => filteredSolicitudes.slice((solPage - 1) * INSUMOS_PAGE_SIZE, solPage * INSUMOS_PAGE_SIZE),
    [filteredSolicitudes, solPage],
  );
  const visibleStock = useMemo(
    () => filteredStock.slice((stockPage - 1) * INSUMOS_PAGE_SIZE, stockPage * INSUMOS_PAGE_SIZE),
    [filteredStock, stockPage],
  );
  const outOfStockCount = useMemo(() => formattedStock.filter(s => s.estado === "Agotado").length, [formattedStock]);
  const lowStockCount = useMemo(
    () => formattedStock.filter(s => s.estado === "Bajo" || s.estado === "Crítico").length,
    [formattedStock],
  );

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...stockForm,
        stockActual: parseInt(stockForm.stockActual) || 0,
        stockMinimo: parseInt(stockForm.stockMinimo) || 0,
        proveedorId: stockForm.proveedorId || undefined,
      };
      await apiFetch("/productos/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Producto registrado exitosamente");
      setIsStockModalOpen(false);
      setStockForm({
        nombre: "",
        categoria: "",
        unidadMedida: "",
        stockActual: "",
        stockMinimo: "",
        proveedorId: "",
      });
    } catch (_error) {
      toast.error("Error inesperado al registrar el producto");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...solicitudForm,
        membershipId: solicitudForm.membershipId || undefined,
      };
      await apiFetch("/productos/solicitudes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Solicitud registrada exitosamente");
      setIsSolicitudModalOpen(false);
      setSolicitudForm({
        productoId: "",
        cantidad: "",
        unidadMedida: "",
        membershipId: "",
      });
    } catch (_error) {
      toast.error("Error inesperado al registrar la solicitud");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, nuevoEstado: "ACEPTADA" | "RECHAZADA") => {
    setProcessingId(id);
    try {
      await apiFetch(`/productos/solicitudes/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      toast.success(`Solicitud ${nuevoEstado === "ACEPTADA" ? "aprobada" : "rechazada"} con éxito`);
    } catch (_error) {
      toast.error("Error inesperado al actualizar la solicitud");
    } finally {
      setProcessingId(null);
    }
  };

  const handleExport = async (formatType: 'excel' | 'pdf' | 'word') => {
    const stockDatasets: ExportDataset = {
      title: "Inventario de Stock / Almacén",
      sheetName: "Stock",
      headers: ["PRODUCTO", "CATEGORÍA", "STOCK ACTUAL", "UNIDAD", "ESTADO"],
      data: formattedStock.map(s => [s.producto, s.categoria, s.stockActual, s.unidad, s.estado])
    };

    const solicitudesDatasets: ExportDataset = {
      title: "Historial de Solicitudes de Insumos",
      sheetName: "Solicitudes",
      headers: ["FECHA", "TÉCNICO", "PRODUCTO", "CANTIDAD", "ESTADO"],
      data: formattedSolicitudes.map(s => [s.fecha, s.tecnico, s.producto, `${s.cantidad} ${s.unidad}`, s.estado])
    };

    const exportOptions = {
      datasets: [stockDatasets, solicitudesDatasets],
      filename: `reporte_insumos_${new Date().getTime()}`,
      mainTitle: "REPORTE DE GESTIÓN DE INSUMOS"
    };

    toast.info(`Generando reporte en formato ${formatType.toUpperCase()}...`);

    try {
      if (formatType === 'excel') await exportMultiToExcel(exportOptions);
      else if (formatType === 'pdf') exportMultiToPDF(exportOptions);
      else if (formatType === 'word') await exportMultiToWord(exportOptions);

      toast.success(`${formatType.toUpperCase()} generado exitosamente`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Error al generar el reporte ${formatType.toUpperCase()}`);
    } finally {
      setShowExportMenu(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[15px] font-medium tracking-tight text-foreground">Gestión de insumos</h1>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Solicitudes · Stock · Almacén operativo
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Button
                variant="outline"
                className={cn(compactActionButtonClass, "border-border bg-card text-foreground shadow-sm hover:bg-muted")}
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                <Download className="h-3 w-3" />
                Exportar
              </Button>

              {showExportMenu && (
                <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Formatos</p>
                  </div>
                  <button onClick={() => handleExport('excel')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                    Excel (.xlsx)
                  </button>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted">
                    <FileText className="h-3.5 w-3.5 text-red-500" />
                    PDF (.pdf)
                  </button>
                  <button onClick={() => handleExport('word')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-muted">
                    <FileIcon className="h-3.5 w-3.5 text-blue-500" />
                    Word (.docx)
                  </button>
                </div>
              )}
            </div>

            <Button variant="outline" className={cn(compactActionButtonClass, "border-border bg-card text-foreground shadow-sm hover:bg-muted")} onClick={() => setIsStockModalOpen(true)}>
              <Plus className="h-3 w-3" />
              Registrar stock
            </Button>
            <Button className={cn(compactActionButtonClass, "border-none bg-[#01ADFB] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-blue-700")} onClick={() => setIsSolicitudModalOpen(true)}>
              <Plus className="h-3 w-3" />
              Nueva solicitud
            </Button>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-border bg-card px-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1600px] gap-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("solicitudes")}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 border-transparent px-5 py-3 text-[12px] font-medium tracking-[0.03em] text-muted-foreground transition-colors hover:text-foreground",
              activeTab === "solicitudes" && "border-[#01ADFB] text-foreground"
            )}
          >
            <History className={cn("h-3.5 w-3.5", activeTab === "solicitudes" ? "text-[#01ADFB]" : "text-muted-foreground")} />
            Solicitudes
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 border-transparent px-5 py-3 text-[12px] font-medium tracking-[0.03em] text-muted-foreground transition-colors hover:text-foreground",
              activeTab === "stock" && "border-[#01ADFB] text-foreground"
            )}
          >
            <Package className={cn("h-3.5 w-3.5", activeTab === "stock" ? "text-[#01ADFB]" : "text-muted-foreground")} />
            Stock / Almacén
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col">
          {activeTab === "solicitudes" ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-end">
                <div className="relative w-full sm:w-[260px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar técnico o producto..."
                    value={solSearch}
                    onChange={(e) => {
                      setSolSearch(e.target.value);
                      setSolPage(1);
                    }}
                    className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[11px] text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-[#01ADFB]"
                  />
                </div>
              </div>

              <GlassCard className="p-0 [content-visibility:auto]">
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full table-fixed border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className={cn(tableHeadClass, "w-[15%]")}>Fecha</th>
                        <th className={cn(tableHeadClass, "w-[28%]")}>Técnico</th>
                        <th className={cn(tableHeadClass, "w-[22%]")}>Producto</th>
                        <th className={cn(tableHeadClass, "w-[15%]")}>Cantidad</th>
                        <th className={cn(tableHeadClass, "w-[20%] text-right")}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSolicitudes.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-xs font-medium text-muted-foreground">No se encontraron solicitudes.</td>
                        </tr>
                      )}
                      {visibleSolicitudes.map((sol) => (
                        <tr key={sol.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                          <td className={cn(tableCellClass, "text-[11px] text-muted-foreground")}>{sol.fecha}</td>
                          <td className={tableCellClass}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-slate-900 text-[9px] font-medium text-white dark:bg-slate-700">{getInitials(sol.tecnico)}</div>
                              <span className="truncate text-xs font-medium text-foreground">{sol.tecnico}</span>
                            </div>
                          </td>
                          <td className={cn(tableCellClass, "truncate text-xs font-medium text-foreground")}>{sol.producto}</td>
                          <td className={tableCellClass}>
                            <span className="text-xs text-foreground tabular-nums">{formatDisplayNumber(sol.cantidad)}</span>
                            {sol.unidad && <span className="ml-1 text-[10px] text-muted-foreground">{sol.unidad}</span>}
                          </td>
                          <td className={cn(tableCellClass, "text-right")}>
                            {sol.rawEstado === "PENDIENTE" ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button size="icon" variant="outline" disabled={!!processingId} className="h-[26px] w-[26px] rounded-md border-border bg-transparent text-muted-foreground hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600" onClick={() => handleUpdateStatus(sol.id, "ACEPTADA")} aria-label="Aprobar solicitud">
                                  {processingId === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                </Button>
                                <Button size="icon" variant="outline" disabled={!!processingId} className="h-[26px] w-[26px] rounded-md border-border bg-transparent text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleUpdateStatus(sol.id, "RECHAZADA")} aria-label="Rechazar solicitud">
                                  {processingId === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                </Button>
                              </div>
                            ) : (
                              <span className={cn("inline-flex items-center gap-1 rounded px-2 py-[3px] text-[10px] font-medium", sol.estado === "Aprobado" && "bg-emerald-500/10 text-emerald-600", sol.estado === "Pendiente" && "bg-amber-500/10 text-amber-600", sol.estado === "Rechazado" && "bg-destructive/10 text-destructive")}>
                                {sol.estado === "Aprobado" && <Check className="h-2.5 w-2.5" />}
                                {sol.estado === "Rechazado" && <X className="h-2.5 w-2.5" />}
                                {sol.estado}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <InsumosPagination page={solPage} pageSize={INSUMOS_PAGE_SIZE} total={filteredSolicitudes.length} itemLabel="solicitudes" onPageChange={setSolPage} />
              </GlassCard>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-end">
                <div className="relative w-full sm:w-[260px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar en almacén..."
                    value={stockSearch}
                    onChange={(e) => {
                      setStockSearch(e.target.value);
                      setStockPage(1);
                    }}
                    className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[11px] text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-[#01ADFB]"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <GlassCard className="border-destructive/20 bg-destructive/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background/70 text-destructive"><AlertCircle className="h-4 w-4" /></div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-destructive">Alertas críticas</p>
                      <p className="text-xl font-medium leading-tight text-destructive tabular-nums">{outOfStockCount}</p>
                      <p className="text-[11px] text-destructive/80">Productos agotados</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-amber-600"><TrendingDown className="h-4 w-4" /></div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Stock bajo</p>
                      <p className="text-xl font-medium leading-tight text-foreground tabular-nums">{lowStockCount}</p>
                      <p className="text-[11px] text-muted-foreground">Referencias en nivel bajo</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              <GlassCard className="p-0 [content-visibility:auto]">
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full table-fixed border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className={cn(tableHeadClass, "w-[35%]")}>Producto</th>
                        <th className={cn(tableHeadClass, "w-[25%]")}>Categoría</th>
                        <th className={cn(tableHeadClass, "w-[25%]")}>Stock</th>
                        <th className={cn(tableHeadClass, "w-[15%] text-right")}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-xs font-medium text-muted-foreground">No se encontraron productos.</td></tr>
                      )}
                      {visibleStock.map((item) => (
                        <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                          <td className={tableCellClass}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground"><Package className="h-3.5 w-3.5" /></div>
                              <span className="truncate text-xs font-medium text-foreground">{item.producto}</span>
                            </div>
                          </td>
                          <td className={tableCellClass}><span className="inline-flex rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">{item.categoria}</span></td>
                          <td className={tableCellClass}>
                            <span className="text-xs text-foreground tabular-nums">{formatDisplayNumber(item.stockActual)}</span>
                            <span className="ml-1 text-[10px] text-muted-foreground">{item.unidad}</span>
                          </td>
                          <td className={cn(tableCellClass, "text-right")}>
                            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", item.estado === "Normal" && "text-emerald-600", item.estado === "Bajo" && "text-amber-600", (item.estado === "Crítico" || item.estado === "Agotado") && "text-destructive", item.estado === "Excedente" && "text-[#01ADFB]")}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", item.estado === "Normal" && "bg-emerald-500", item.estado === "Bajo" && "bg-amber-500", (item.estado === "Crítico" || item.estado === "Agotado") && "bg-destructive", item.estado === "Excedente" && "bg-[#01ADFB]")} />
                              {item.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <InsumosPagination page={stockPage} pageSize={INSUMOS_PAGE_SIZE} total={filteredStock.length} itemLabel="productos" onPageChange={setStockPage} />
              </GlassCard>
            </div>
          )}
        </div>
      </div>
      {/* Registrar Stock Modal */}
      <Dialog open={isStockModalOpen} onOpenChange={setIsStockModalOpen}>
        <DialogContent className="max-w-md rounded-lg border-border bg-background">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-[13px] font-medium text-foreground">
              Registrar producto
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground">Agrega una referencia al almacén.</p>
          </DialogHeader>
          <form onSubmit={handleCreateStock} className="space-y-4 pt-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="nombre" className={labelClass}>Nombre del producto</Label>
                <Input 
                  id="nombre" 
                  value={stockForm.nombre} 
                  onChange={(e) => setStockForm({...stockForm, nombre: e.target.value})}
                  required
                  placeholder="Ej: Refrigerante R410A"
                  className={fieldClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="categoria" className={labelClass}>Categoría</Label>
                  <Input 
                    id="categoria" 
                    value={stockForm.categoria} 
                    onChange={(e) => setStockForm({...stockForm, categoria: e.target.value})}
                    placeholder="Ej: Consumibles"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unidadMedida" className={labelClass}>Unidad</Label>
                  <Input 
                    id="unidadMedida" 
                    value={stockForm.unidadMedida} 
                    onChange={(e) => setStockForm({...stockForm, unidadMedida: e.target.value})}
                    placeholder="Ej: kg, m, unid"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="stockActual" className={labelClass}>Stock inicial</Label>
                  <Input 
                    id="stockActual" 
                    type="number"
                    value={stockForm.stockActual} 
                    onChange={(e) => setStockForm({...stockForm, stockActual: e.target.value})}
                    placeholder="0"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockMinimo" className={labelClass}>Stock mínimo</Label>
                  <Input 
                    id="stockMinimo" 
                    type="number"
                    value={stockForm.stockMinimo} 
                    onChange={(e) => setStockForm({...stockForm, stockMinimo: e.target.value})}
                    placeholder="Ej: 5"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proveedor" className={labelClass}>Proveedor opcional</Label>
                <Select 
                  id="proveedor"
                  value={stockForm.proveedorId} 
                  onChange={(e) => setStockForm({...stockForm, proveedorId: e.target.value})}
                  className={fieldClass}
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="h-9 w-full rounded-md bg-[#01ADFB] text-[11px] font-medium text-white hover:bg-[#01ADFB]/90"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Registrar producto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nueva Solicitud Modal */}
      <Dialog open={isSolicitudModalOpen} onOpenChange={setIsSolicitudModalOpen}>
        <DialogContent className="max-w-md rounded-lg border-border bg-background">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-[13px] font-medium text-foreground">
              Nueva solicitud
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground">Registra la entrega o solicitud de material.</p>
          </DialogHeader>
          <form onSubmit={handleCreateSolicitud} className="space-y-4 pt-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="producto" className={labelClass}>Producto</Label>
                <Select 
                  id="producto"
                  value={solicitudForm.productoId} 
                  onChange={(e) => setSolicitudForm({...solicitudForm, productoId: e.target.value})}
                  required
                  className={fieldClass}
                >
                  <option value="">Seleccionar producto</option>
                  {initialStock.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.stockActual} {p.unidadMedida})</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cantidad" className={labelClass}>Cantidad</Label>
                  <Input 
                    id="cantidad" 
                    value={solicitudForm.cantidad} 
                    onChange={(e) => setSolicitudForm({...solicitudForm, cantidad: e.target.value})}
                    required
                    placeholder="Ej: 5"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="solUnidad" className={labelClass}>Unidad opcional</Label>
                  <Input 
                    id="solUnidad" 
                    value={solicitudForm.unidadMedida} 
                    onChange={(e) => setSolicitudForm({...solicitudForm, unidadMedida: e.target.value})}
                    placeholder="Ej: kg"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tecnico" className={labelClass}>Solicitado para</Label>
                <Select 
                  id="tecnico"
                  value={solicitudForm.membershipId} 
                  onChange={(e) => setSolicitudForm({...solicitudForm, membershipId: e.target.value})}
                  className={fieldClass}
                >
                  <option value="">Solicitante (Yo)</option>
                  {memberships.map((m) => (
                    <option key={m.id} value={m.id}>{m.user.nombre} {m.user.apellido} ({m.role})</option>
                  ))}
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button 
                type="submit" 
                disabled={isSubmitting || !solicitudForm.productoId}
                className="h-9 w-full rounded-md bg-[#01ADFB] text-[11px] font-medium text-white hover:bg-[#01ADFB]/90"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar solicitud"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
