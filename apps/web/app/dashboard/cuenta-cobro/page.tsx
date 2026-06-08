"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  Plus,
  Trash2,
  Pencil,
  Camera,
  Clock,
  Calendar as CalendarIcon,
  X,
  Save,
  Image as ImageIcon,
  Calculator,
  Lock,
  History,
  FileSpreadsheet,
  Eye,
  } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";
import { type ShiftType, type PeriodType, type UserProfileType } from "../schemas/user.schema";
import { contabilidadClient } from "@/lib/api/contabilidad-client";
import { uploadToSupabaseSignedUrl } from "../servicios/api";
import { differenceInMinutes, parse, format } from "date-fns";
import { es } from "date-fns/locale";
import { ymdToPickerDate, getZonedDate, formatBogotaDateTime } from "@/utils/date-utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const billingPanelClass = "rounded-lg border border-border bg-card shadow-sm";
const billingPrimaryButtonClass =
  "rounded-md border-none bg-[#01ADFB] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-[#0197dc]";
const billingSecondaryButtonClass =
  "rounded-md border-border bg-card text-foreground shadow-sm hover:bg-muted";
const billingInputClass =
  "h-10 rounded-md border-border bg-background text-[12px] font-medium text-foreground";
const billingTableHeadClass =
  "bg-muted/50 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

function resolveCuentaCobroEvidenceUrl(
  path?: string | null,
  signedUrl?: string | null,
) {
  if (signedUrl) return signedUrl;
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return "";
}

export default function CuentaCobroPage() {
  const [activeTab, setActiveTab] = useState<"actual" | "pagos">("actual");
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [periods, setPeriods] = useState<PeriodType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserProfileType | null>(null);
  const [valorHora, setValorHora] = useState<number>(0);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [formEvidenceUrls, setFormEvidenceUrls] = useState({
    fotoLlegada: "",
    fotoSalida: "",
  });

  // Form state
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    horaEntrada: "08:00",
    horaSalida: "17:00",
    descansoMinutos: 60,
    observacion: "",
    fotoLlegada: "",
    fotoSalida: ""
  });

  const fotoLlegadaRef = useRef<HTMLInputElement>(null);
  const fotoSalidaRef = useRef<HTMLInputElement>(null);

  const loadDashboard = useCallback(async (targetEmpresaId?: string) => {
    try {
      setLoading(true);
      const data = await contabilidadClient.getCuentaCobro(targetEmpresaId);
      setEmpresaId(data.empresaId);
      setShifts(data.turnos);
      setPeriods(data.periodos);
      setUser(data.userSnapshot);
      setValorHora(data.valorHora || data.userSnapshot.valorHora || 0);

      if ((data.valorHora || data.userSnapshot.valorHora || 0) <= 0) {
        toast.warning("Configura el valor por hora para calcular honorarios.");
      }
    } catch (error) {
      console.error("Error loading cuenta de cobro", error);
      toast.error("No se pudo cargar la cuenta de cobro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const rawEmpresaId =
      localStorage.getItem("current-enterprise-id") ||
      localStorage.getItem("x-enterprise-id") ||
      "";
    const selectedEmpresaId =
      rawEmpresaId && rawEmpresaId !== "all" && rawEmpresaId !== "undefined"
        ? rawEmpresaId
        : "";

    setEmpresaId(selectedEmpresaId);
    void loadDashboard(selectedEmpresaId || undefined);
  }, [loadDashboard]);

  const handleOpenModal = (shift: ShiftType | null = null) => {
    if (shift) {
      setEditingShift(shift);
      setFormData({
        fecha: shift.fecha,
        horaEntrada: shift.horaEntrada,
        horaSalida: shift.horaSalida,
        descansoMinutos: shift.descansoMinutos,
        observacion: shift.observacion || "",
        fotoLlegada: shift.fotoLlegada || "",
        fotoSalida: shift.fotoSalida || ""
      });
      setFormEvidenceUrls({
        fotoLlegada: shift.fotoLlegadaUrl || "",
        fotoSalida: shift.fotoSalidaUrl || "",
      });
    } else {
      setEditingShift(null);
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        horaEntrada: "08:00",
        horaSalida: "17:00",
        descansoMinutos: 60,
        observacion: "",
        fotoLlegada: "",
        fotoSalida: ""
      });
      setFormEvidenceUrls({ fotoLlegada: "", fotoSalida: "" });
    }
    setIsModalOpen(true);
  };

  const handleUpload = async (file: File, type: 'llegada' | 'salida') => {
    if (!empresaId) {
      toast.error("Seleccioná una empresa antes de subir evidencias.");
      return;
    }

    setLoading(true);
    try {
      const upload = await contabilidadClient.crearCuentaCobroUploadUrl({
        empresaId,
        fileName: file.name,
        contentType: file.type,
        tipo: type,
      });

      await uploadToSupabaseSignedUrl(upload.path, upload.token, file);

      setFormData(prev => ({
        ...prev,
        [type === 'llegada' ? 'fotoLlegada' : 'fotoSalida']:
          upload.path,
      }));
      setFormEvidenceUrls(prev => ({
        ...prev,
        [type === 'llegada' ? 'fotoLlegada' : 'fotoSalida']:
          URL.createObjectURL(file),
      }));
      toast.success("Foto subida correctamente");
    } catch (error) {
      console.error("Error uploading cuenta de cobro evidence", error);
      toast.error("No se pudo subir la evidencia.");
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (entrada: string, salida: string, descanso: number) => {
    try {
      if (!entrada || !salida) return 0;
      const refDate = new Date();
      const start = parse(entrada, 'HH:mm', refDate);
      let end = parse(salida, 'HH:mm', refDate);

      if (end < start) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }

      const diffMinutes = differenceInMinutes(end, start);
      const netMinutes = diffMinutes - (descanso || 0);
      return Math.max(0, netMinutes / 60);
    } catch (_e) {
      return 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!empresaId) {
      toast.error("Seleccioná una empresa antes de registrar turnos.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        empresaId,
        fecha: formData.fecha,
        horaEntrada: formData.horaEntrada,
        horaSalida: formData.horaSalida,
        descansoMinutos: formData.descansoMinutos,
        observacion: formData.observacion,
        fotoLlegada: formData.fotoLlegada,
        fotoSalida: formData.fotoSalida,
      };

      if (editingShift) {
        const updatedShift = await contabilidadClient.actualizarCuentaCobroTurno(
          editingShift.id,
          payload,
        );
        setShifts((current) =>
          current.map((shift) =>
            shift.id === editingShift.id ? updatedShift : shift,
          ),
        );
        toast.success("Turno actualizado");
      } else {
        const createdShift = await contabilidadClient.crearCuentaCobroTurno(payload);
        setShifts((current) => [createdShift, ...current]);
        toast.success("Turno registrado");
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving cuenta de cobro shift", error);
      toast.error("Error al guardar el turno");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Eliminar este registro?")) {
      try {
        setLoading(true);
        await contabilidadClient.eliminarCuentaCobroTurno(id);
        setShifts((current) => current.filter((shift) => shift.id !== id));
      toast.success("Registro eliminado");
      } catch (error) {
        console.error("Error deleting cuenta de cobro shift", error);
        toast.error("No se pudo eliminar el registro.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCerrarPeriodo = async () => {
    if (shifts.length === 0) return;
    if (!empresaId) {
      toast.error("Seleccioná una empresa antes de cerrar el corte.");
      return;
    }
    setIsCloseModalOpen(true);
  };

  const handleConfirmCerrarPeriodo = async () => {
    if (shifts.length === 0 || !empresaId) return;
    try {
      setLoading(true);
      const newPeriod = await contabilidadClient.cerrarCuentaCobroPeriodo(empresaId);
      setPeriods((current) => [newPeriod, ...current]);
      setShifts([]);
      setIsCloseModalOpen(false);
      toast.success("Periodo cerrado correctamente");
      await handleExportPDF(newPeriod);
      setActiveTab("pagos");
    } catch (error) {
      console.error("Error closing cuenta de cobro period", error);
      toast.error("No se pudo cerrar el periodo.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async (period: PeriodType) => {
    const totalDescanso = period.shifts.reduce(
      (total, s) => total + (s.descansoMinutos || 0),
      0,
    );
    const fullName = `${period.userSnapshot.nombre || ""} ${period.userSnapshot.apellido || ""}`.trim();
    const periodLabel = `${format(ymdToPickerDate(period.fechaInicio)!, "dd/MM/yyyy", { locale: es })} al ${format(ymdToPickerDate(period.fechaFin)!, "dd/MM/yyyy", { locale: es })}`;
    const bankInfo = [
      period.userSnapshot.banco || "Banco no registrado",
      period.userSnapshot.tipoCuenta || "Tipo no registrado",
      period.userSnapshot.numeroCuenta || "Cuenta no registrada",
    ].join(" · ");
    const doc = new jsPDF({ orientation: "landscape" });
    const brandColor: [number, number, number] = [1, 173, 251];
    const dark: [number, number, number] = [24, 24, 27];
    const muted: [number, number, number] = [113, 113, 122];

    doc.setFillColor(...brandColor);
    doc.rect(0, 0, 297, 15, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    doc.setTextColor(...dark);
    doc.text("TENAXIS", 15, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("SISTEMA INTEGRAL DE GESTIÓN OPERATIVA", 15, 38);

    doc.setFillColor(244, 244, 245);
    doc.roundedRect(218, 24, 64, 22, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...brandColor);
    doc.text("CUENTA DE COBRO", 224, 33);
    doc.setFontSize(7);
    doc.setTextColor(...dark);
    doc.text(`GEN: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 224, 39);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...dark);
    doc.text(`CUENTA DE COBRO: ${fullName || "Sin nombre"}`, 15, 57);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`Documento: ${period.userSnapshot.tipoDocumento || "N/A"} ${period.userSnapshot.numeroDocumento || ""}`, 15, 64);
    doc.text(`Periodo: ${periodLabel}`, 15, 70);
    const bankLines = doc.splitTextToSize(`Información bancaria: ${bankInfo}`, 180);
    doc.text(bankLines, 15, 76);
    const tableStartY = 84 + bankLines.length * 4;

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(210, 54, 72, 26, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text("TOTAL A PAGAR", 216, 63);
    doc.setFontSize(14);
    doc.text(`$${period.valorTotal.toLocaleString()}`, 216, 73);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: 15, right: 15 },
      head: [["FECHA", "ENTRADA", "SALIDA", "DESCANSO", "HORAS NETAS", "VALOR", "NOTAS"]],
      body: [
        ...period.shifts.map((s) => [
          format(ymdToPickerDate(s.fecha)!, "dd/MM/yyyy", { locale: es }),
          s.horaEntrada,
          s.horaSalida,
          `${s.descansoMinutos} min`,
          `${s.totalHoras.toFixed(2)}h`,
          `$${s.valorGenerado.toLocaleString()}`,
          s.observacion || "",
        ]),
        [
          "TOTALES",
          "",
          "",
          `${totalDescanso} min`,
          `${period.horasTotales.toFixed(2)}h`,
          `$${period.valorTotal.toLocaleString()}`,
          "",
        ],
      ],
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
        lineColor: [228, 228, 231],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: dark,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        5: { halign: "right" },
        6: { cellWidth: 42 },
      },
      didParseCell: (data) => {
        if (data.row.index === period.shifts.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 118;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, finalY + 8, 267, 24, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...dark);
    doc.text("RESUMEN DE LIQUIDACIÓN", 21, finalY + 17);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(`Días laborados: ${period.numDias}`, 21, finalY + 25);
    doc.text(`Horas netas: ${period.horasTotales.toFixed(2)}h`, 80, finalY + 25);
    doc.text(`Descanso total: ${totalDescanso} min`, 135, finalY + 25);
    doc.text(`Total liquidado: $${period.valorTotal.toLocaleString()}`, 195, finalY + 25);

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(7);
      doc.setTextColor(161, 161, 170);
      doc.text(
        `Página ${page} de ${pageCount} | Documento Tenaxis | Generado el ${formatBogotaDateTime(new Date())}`,
        15,
        doc.internal.pageSize.getHeight() - 10,
      );
    }

    doc.save(`Cuenta_Cobro_${fullName || "colaborador"}_${period.fechaInicio}.pdf`);
    toast.success("PDF generado correctamente");
  };

  const openPreview = (url: string) => {
    setPreviewUrl(url);
    setIsPreviewOpen(true);
  };

  const totalGenerado = (shifts || []).reduce((acc, s) => acc + (s.valorGenerado || 0), 0);
  const totalHorasMes = (shifts || []).reduce((acc, s) => acc + (s.totalHoras || 0), 0);
  const totalDescansoMinutos = (shifts || []).reduce((acc, s) => acc + (s.descansoMinutos || 0), 0);
  const sortedCurrentShifts = [...(shifts || [])].sort((a, b) => {
    const dateCompare = a.fecha.localeCompare(b.fecha);
    return dateCompare !== 0 ? dateCompare : a.horaEntrada.localeCompare(b.horaEntrada);
  });
  const closePeriodStart = sortedCurrentShifts[0]?.fecha;
  const closePeriodEnd = sortedCurrentShifts[sortedCurrentShifts.length - 1]?.fecha;

  return (
    <DashboardLayout overflowHidden>
      <div className="flex h-full flex-col bg-background">
        <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-[15px] font-medium tracking-tight text-foreground">
                  Cuenta de cobro
                </h1>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Gestión de turnos y honorarios
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-b border-border bg-background px-4 py-3 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("actual")}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[10px] font-medium transition-colors",
                  activeTab === "actual"
                    ? "border-border bg-card text-foreground shadow-sm"
                    : "border-border bg-transparent text-muted-foreground hover:bg-muted",
                )}
              >
                <Clock className="h-3.5 w-3.5" /> Actual
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pagos")}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[10px] font-medium transition-colors",
                  activeTab === "pagos"
                    ? "border-border bg-card text-foreground shadow-sm"
                    : "border-border bg-transparent text-muted-foreground hover:bg-muted",
                )}
              >
                <History className="h-3.5 w-3.5" /> Pagos
              </button>
            </div>

            {activeTab === "actual" && (
              <Button
                type="button"
                onClick={() => handleOpenModal()}
                className={cn("h-8 gap-1.5 px-3 text-[10px] font-medium", billingPrimaryButtonClass)}
              >
                <Plus className="h-3.5 w-3.5" /> Registrar
              </Button>
            )}
          </div>
        </div>

        {activeTab === "actual" && (
          <div className="shrink-0 border-b border-border bg-card px-4 sm:px-6 lg:px-10">
            <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="px-0 py-3 sm:px-4">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Calculator className="h-3.5 w-3.5" /> Generado
                </p>
                <p className="mt-1 text-xl font-medium tracking-tight text-foreground">${totalGenerado.toLocaleString()}</p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Corte actual</p>
              </div>
              <div className="px-0 py-3 sm:px-4">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Horas
                </p>
                <p className="mt-1 text-xl font-medium tracking-tight text-foreground">{totalHorasMes.toFixed(1)}h</p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">En este período</p>
              </div>
              <div className="px-0 py-3 sm:px-4">
                <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <CalendarIcon className="h-3.5 w-3.5" /> Días
                </p>
                <p className="mt-1 text-xl font-medium tracking-tight text-foreground">{shifts.length}</p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Turnos registrados</p>
              </div>
              <button
                type="button"
                onClick={handleCerrarPeriodo}
                disabled={shifts.length === 0}
                className="flex min-h-[78px] items-center justify-start gap-2 px-0 py-3 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 sm:justify-center sm:px-4"
              >
                <Lock className="h-4 w-4" /> Cerrar corte
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-[1600px] pb-10">
            {activeTab === "actual" ? (
              <Card className={cn(billingPanelClass, "overflow-hidden")}>
                <table className="w-full text-left">
                  <thead className="border-b border-border">
                    <tr className={billingTableHeadClass}>
                      <th className="px-4 py-2.5">Fecha / Horario</th>
                      <th className="px-4 py-2.5">Evidencias</th>
                      <th className="px-4 py-2.5">Descanso</th>
                      <th className="px-4 py-2.5 text-right">Valor</th>
                      <th className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shifts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-14 text-center">
                          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
                            <CalendarIcon className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-foreground">Sin turnos registrados</p>
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                            Registra un turno para comenzar el corte actual.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      shifts.map((s) => (
                        <tr key={s.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-foreground">{format(ymdToPickerDate(s.fecha)!, 'EEE dd MMM', { locale: es })}</p>
                            <p className="mt-0.5 text-[10px] font-medium uppercase text-muted-foreground">{s.horaEntrada} - {s.horaSalida} ({s.totalHoras.toFixed(1)}h)</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {s.fotoLlegada && <button onClick={() => openPreview(resolveCuentaCobroEvidenceUrl(s.fotoLlegada, s.fotoLlegadaUrl))} className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all hover:border-[#01ADFB] hover:text-[#01ADFB]"><ImageIcon className="h-4 w-4" /></button>}
                              {s.fotoSalida && <button onClick={() => openPreview(resolveCuentaCobroEvidenceUrl(s.fotoSalida, s.fotoSalidaUrl))} className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all hover:border-amber-500 hover:text-amber-600"><ImageIcon className="h-4 w-4" /></button>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[11px] font-medium uppercase text-muted-foreground">{s.descansoMinutos} min</td>
                          <td className="px-4 py-3 text-right text-[13px] font-medium text-emerald-600">${s.valorGenerado.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenModal(s)} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="h-8 w-8 rounded-md text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            ) : (
              <Card className={cn(billingPanelClass, "overflow-hidden")}>
                <table className="w-full text-left">
                  <thead className="border-b border-border">
                    <tr className={billingTableHeadClass}>
                      <th className="px-4 py-2.5">Período liquidado</th>
                      <th className="px-4 py-2.5">Días / Horas</th>
                      <th className="px-4 py-2.5 text-right">Valor total</th>
                      <th className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {periods.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-14 text-center">
                          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
                            <History className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-foreground">Sin pagos registrados</p>
                          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                            Los cortes cerrados aparecerán en este historial.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      periods.map((p) => (
                        <tr key={p.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-foreground">{format(ymdToPickerDate(p.fechaInicio)!, 'dd MMM', { locale: es })} - {format(ymdToPickerDate(p.fechaFin)!, 'dd MMM', { locale: es })}</p>
                            <p className="mt-0.5 text-[10px] font-medium uppercase text-[#01ADFB]">Cerrado: {format(getZonedDate(p.fechaCierre), 'dd/MM/yyyy', { locale: es })}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-foreground">{p.numDias} días / {p.horasTotales.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-[13px] font-medium text-emerald-600">${p.valorTotal.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedPeriod(p); setIsDetailModalOpen(true); }} className="h-8 rounded-md px-2.5 text-[10px] font-medium text-[#01ADFB] hover:bg-[#01ADFB]/10"><Eye className="mr-1.5 h-3.5 w-3.5" /> Detalles</Button>
                              <Button variant="ghost" size="sm" onClick={() => handleExportPDF(p)} className="h-8 rounded-md px-2.5 text-[10px] font-medium text-destructive hover:bg-destructive/10"><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> PDF</Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modal Turno */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl overflow-hidden rounded-lg border-border bg-card shadow-xl">
            <form onSubmit={handleSubmit}>
              <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-card px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB]"><Clock className="h-4 w-4" /></div>
                  <div><CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">{editingShift ? 'Editar' : 'Registrar'} turno</CardTitle><CardDescription className="text-xs font-medium text-muted-foreground">Completa los detalles de la jornada</CardDescription></div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="h-8 w-8 rounded-md border border-border"><X className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="space-y-5 px-6 py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Fecha</Label><Input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} required className={billingInputClass} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Descanso (min)</Label><Input type="number" value={formData.descansoMinutos} onChange={e => setFormData({...formData, descansoMinutos: parseInt(e.target.value) || 0})} required className={billingInputClass} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Entrada</Label><Input type="time" value={formData.horaEntrada} onChange={e => setFormData({...formData, horaEntrada: e.target.value})} required className={cn(billingInputClass, "text-[#01ADFB]")} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Salida</Label><Input type="time" value={formData.horaSalida} onChange={e => setFormData({...formData, horaSalida: e.target.value})} required className={cn(billingInputClass, "text-amber-600")} /></div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div onClick={() => fotoLlegadaRef.current?.click()} className={cn("relative flex h-28 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 transition-colors hover:bg-muted/40", formData.fotoLlegada && "border-[#01ADFB]/50")}>
                    {formData.fotoLlegada ? <>{/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveCuentaCobroEvidenceUrl(formData.fotoLlegada, formEvidenceUrls.fotoLlegada)} alt="Llegada" className="absolute inset-0 h-full w-full object-cover opacity-40" /><Camera className="relative z-10 h-5 w-5 text-[#01ADFB]" /></> : <><Camera className="h-5 w-5 text-muted-foreground" /><span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Foto llegada</span></>}
                    <input type="file" ref={fotoLlegadaRef} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'llegada')} />
                  </div>
                  <div onClick={() => fotoSalidaRef.current?.click()} className={cn("relative flex h-28 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 transition-colors hover:bg-muted/40", formData.fotoSalida && "border-amber-500/50")}>
                    {formData.fotoSalida ? <>{/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveCuentaCobroEvidenceUrl(formData.fotoSalida, formEvidenceUrls.fotoSalida)} alt="Salida" className="absolute inset-0 h-full w-full object-cover opacity-40" /><Camera className="relative z-10 h-5 w-5 text-amber-600" /></> : <><Camera className="h-5 w-5 text-muted-foreground" /><span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Foto salida</span></>}
                    <input type="file" ref={fotoSalidaRef} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'salida')} />
                  </div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Notas</Label><Textarea value={formData.observacion} onChange={e => setFormData({...formData, observacion: e.target.value})} placeholder="..." className="min-h-20 rounded-md border-border bg-background text-sm" /></div>
              </CardContent>
              <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/20 px-6 py-4">
                <div><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Estimado</p><p className="text-lg font-medium text-emerald-600">${(calculateHours(formData.horaEntrada, formData.horaSalida, formData.descansoMinutos) * (valorHora || 0)).toLocaleString()}</p></div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className={cn("h-9 px-4 text-[10px] font-medium", billingSecondaryButtonClass)}>Cancelar</Button>
                  <Button type="submit" disabled={loading} className={cn("h-9 px-4 text-[10px] font-medium", billingPrimaryButtonClass)}><Save className="mr-1.5 h-3.5 w-3.5" /> {editingShift ? 'Actualizar' : 'Registrar'}</Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal Preview */}
      {isPreviewOpen && (
        <div onClick={() => setIsPreviewOpen(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button onClick={() => setIsPreviewOpen(false)} className="absolute -top-12 right-0 text-white hover:text-[#01ADFB] transition-colors"><X className="h-8 w-8" /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="max-h-[80vh] max-w-full rounded-lg border border-white/10 object-contain shadow-xl" />
            <div className="absolute -bottom-12 left-0 right-0 text-center"><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">Vista previa de evidencia</p></div>
          </div>
        </div>
      )}

      {/* Modal Cierre de Corte */}
      {isCloseModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-5xl overflow-hidden rounded-lg border-border bg-card shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-card px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB]"><Lock className="h-4 w-4" /></div>
                <div><CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Previsualización del corte</CardTitle><CardDescription className="text-xs font-medium text-muted-foreground">Revisá días, horas, descansos y total antes de cerrar.</CardDescription></div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsCloseModalOpen(false)} className="h-8 w-8 rounded-md border border-border"><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="max-h-[66vh] overflow-y-auto p-0">
              <div className="grid gap-0 border-b border-border bg-muted/20 sm:grid-cols-4">
                <div className="border-b border-border p-5 sm:border-b-0 sm:border-r"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Periodo</p><p className="mt-2 text-sm font-medium text-foreground">{closePeriodStart && closePeriodEnd ? `${format(ymdToPickerDate(closePeriodStart)!, "dd/MM/yyyy", { locale: es })} – ${format(ymdToPickerDate(closePeriodEnd)!, "dd/MM/yyyy", { locale: es })}` : "Sin fechas"}</p></div>
                <div className="border-b border-border p-5 sm:border-b-0 sm:border-r"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Días laborados</p><p className="mt-2 text-xl font-medium text-foreground">{shifts.length}</p></div>
                <div className="border-b border-border p-5 sm:border-b-0 sm:border-r"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Horas / descanso</p><p className="mt-2 text-sm font-medium text-foreground">{totalHorasMes.toFixed(2)}h · {totalDescansoMinutos} min</p></div>
                <div className="p-5"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total a pagar</p><p className="mt-2 text-xl font-medium text-emerald-600">${totalGenerado.toLocaleString()}</p></div>
              </div>
              <div className="border-b border-border px-6 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-card p-3"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Colaborador</p><p className="mt-1 text-sm font-medium text-foreground">{user?.nombre} {user?.apellido}</p></div>
                  <div className="rounded-md border border-border bg-card p-3"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Valor hora</p><p className="mt-1 text-sm font-medium text-foreground">${valorHora.toLocaleString()}</p></div>
                  <div className="rounded-md border border-border bg-card p-3"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Documento</p><p className="mt-1 text-sm font-medium text-foreground">PDF al confirmar</p></div>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="border-b border-border"><tr className={billingTableHeadClass}><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Horario</th><th className="px-4 py-2.5">Descanso</th><th className="px-4 py-2.5">Horas netas</th><th className="px-4 py-2.5 text-right">Valor</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {sortedCurrentShifts.map((shift) => (
                    <tr key={shift.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{format(ymdToPickerDate(shift.fecha)!, "EEE dd MMM", { locale: es })}</td>
                      <td className="px-4 py-3 text-xs font-medium text-muted-foreground">{shift.horaEntrada} – {shift.horaSalida}</td>
                      <td className="px-4 py-3 text-xs font-medium text-muted-foreground">{shift.descansoMinutos} min</td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{shift.totalHoras.toFixed(2)}h</td>
                      <td className="px-4 py-3 text-right text-[13px] font-medium text-emerald-600">${shift.valorGenerado.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Al confirmar, el corte queda cerrado y se descargará el PDF de liquidación.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCloseModalOpen(false)} className={cn("h-9 px-4 text-[10px] font-medium", billingSecondaryButtonClass)}>Cancelar</Button>
                <Button onClick={handleConfirmCerrarPeriodo} disabled={loading} className={cn("h-9 px-4 text-[10px] font-medium", billingPrimaryButtonClass)}><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Cerrar y descargar PDF</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Detalle Periodo */}
      {isDetailModalOpen && selectedPeriod && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-4xl overflow-hidden rounded-lg border-border bg-card shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-card px-6 py-5">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600"><History className="h-4 w-4" /></div><div><CardTitle className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">Liquidación</CardTitle><CardDescription className="text-xs font-medium text-muted-foreground">{format(ymdToPickerDate(selectedPeriod.fechaInicio)!, 'dd/MM/yyyy', { locale: es })} - {format(ymdToPickerDate(selectedPeriod.fechaFin)!, 'dd/MM/yyyy', { locale: es })}</CardDescription></div></div>
              <Button variant="ghost" size="icon" onClick={() => setIsDetailModalOpen(false)} className="h-8 w-8 rounded-md border border-border"><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto p-0">
              <div className="grid gap-4 border-b border-border bg-muted/20 p-5 sm:grid-cols-3">
                <div className="space-y-1"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Colaborador</p><p className="text-sm font-medium text-foreground">{selectedPeriod.userSnapshot.nombre} {selectedPeriod.userSnapshot.apellido}</p></div>
                <div className="space-y-1 sm:text-center"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Días / Horas</p><p className="text-sm font-medium text-foreground">{selectedPeriod.numDias} / {selectedPeriod.horasTotales.toFixed(1)}h</p></div>
                <div className="space-y-1 sm:text-right"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Total pago</p><p className="text-lg font-medium text-emerald-600">${selectedPeriod.valorTotal.toLocaleString()}</p></div>
              </div>
              <table className="w-full text-left">
                <thead className="border-b border-border"><tr className={billingTableHeadClass}><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Horario</th><th className="px-4 py-2.5">Evidencias</th><th className="px-4 py-2.5 text-right">Valor</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {selectedPeriod.shifts.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{format(ymdToPickerDate(s.fecha)!, 'dd/MM/yyyy', { locale: es })}</td>
                      <td className="px-4 py-3 text-xs font-medium text-muted-foreground">{s.horaEntrada}-{s.horaSalida} ({s.totalHoras.toFixed(1)}h)</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {s.fotoLlegada && (
                            <button onClick={() => openPreview(resolveCuentaCobroEvidenceUrl(s.fotoLlegada, s.fotoLlegadaUrl))} className="group/ev flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition-all hover:border-[#01ADFB]">
                              <ImageIcon className="h-4 w-4 text-muted-foreground group-hover/ev:text-[#01ADFB]" />
                            </button>
                          )}
                          {s.fotoSalida && (
                            <button onClick={() => openPreview(resolveCuentaCobroEvidenceUrl(s.fotoSalida, s.fotoSalidaUrl))} className="group/ev flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition-all hover:border-amber-500">
                              <ImageIcon className="h-4 w-4 text-muted-foreground group-hover/ev:text-amber-600" />
                            </button>
                          )}
                          {!s.fotoLlegada && !s.fotoSalida && <span className="text-[10px] text-muted-foreground italic">Sin fotos</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-medium text-emerald-600">${s.valorGenerado.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <div className="flex justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
              <Button onClick={() => handleExportPDF(selectedPeriod)} className="h-9 rounded-md bg-destructive px-4 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/90"><FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> PDF</Button>
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)} className={cn("h-9 px-4 text-[10px] font-medium", billingSecondaryButtonClass)}>Cerrar</Button>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
