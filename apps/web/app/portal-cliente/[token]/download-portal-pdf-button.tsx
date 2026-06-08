"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import type { PortalPublicResponse, PortalServicio } from "./types";
import {
  formatPortalDate,
  getClienteEnterprise,
  getClienteDocument,
  getClienteName,
  getSelectedServices,
  getServiceAssignee,
  getServiceCode,
  getServiceDate,
  getServiceLocation,
  getServiceSummary,
  getServiceTitle,
  normalizeStatus,
} from "./format";

type DownloadPortalPdfButtonProps = {
  data: PortalPublicResponse;
};

const sanitizeFilename = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "cliente";

export function DownloadPortalPdfButton({ data }: DownloadPortalPdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const addWrappedText = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number) => {
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    doc.text(lines, x, y);
    return y + lines.length * 5;
  };

  const ensureSpace = (doc: jsPDF, y: number, required = 24) => {
    if (y + required <= 280) return y;
    doc.addPage();
    return 20;
  };

  const renderService = (doc: jsPDF, servicio: PortalServicio, index: number, startY: number) => {
    let y = ensureSpace(doc, startY, 38);
    doc.setDrawColor(226, 232, 240);
    doc.line(18, y - 4, 192, y - 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${index}. ${getServiceTitle(servicio)}`, 18, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    y += 6;
    doc.text(`${getServiceCode(servicio)} · ${normalizeStatus(servicio.estado)}`, 18, y);
    y += 5;
    doc.text(`Fecha: ${getServiceDate(servicio)}`, 18, y);
    y += 5;
    y = addWrappedText(doc, `Lugar: ${getServiceLocation(servicio)}`, 18, y, 170) + 1;
    doc.text(`Equipo: ${getServiceAssignee(servicio)}`, 18, y);
    y += 5;
    y = addWrappedText(doc, `Detalle: ${getServiceSummary(servicio)}`, 18, y, 170) + 4;
    const selectedServices = getSelectedServices(servicio);
    if (selectedServices.length > 0) {
      y = addWrappedText(doc, `Servicios incluidos: ${selectedServices.join(" · ")}`, 18, y, 170) + 4;
    }
    if (servicio.recomendaciones) {
      y = addWrappedText(doc, `Recomendaciones: ${servicio.recomendaciones}`, 18, y, 170) + 4;
    }
    return y;
  };

  const handleDownload = () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const clienteName = getClienteName(data.cliente);

      doc.setFillColor(2, 19, 89);
      doc.rect(0, 0, 210, 34, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Portal del cliente", 18, 17);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generado: ${formatPortalDate(data.generadoAt || new Date().toISOString(), true)}`, 18, 25);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(clienteName, 18, 48);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(getClienteDocument(data.cliente), 18, 56);
      doc.text(getClienteEnterprise(data.cliente) || "Empresa no registrada", 18, 63);
      doc.text(data.cliente.correo || "Correo no registrado", 18, 70);
      doc.text(data.cliente.telefono || "Teléfono no registrado", 18, 77);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Resumen", 18, 86);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Próxima visita: ${data.proximoServicio ? getServiceDate(data.proximoServicio) : "Sin visita agendada"}`, 18, 96);
      doc.text(`Última atención: ${data.ultimoServicio ? getServiceDate(data.ultimoServicio) : "Sin atención registrada"}`, 18, 103);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Historial", 18, 120);

      let y = 132;
      if (data.historial.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Todavía no hay atenciones para mostrar.", 18, y);
      } else {
        data.historial.forEach((servicio, index) => {
          y = renderService(doc, servicio, index + 1, y);
        });
      }

      doc.save(`portal-${sanitizeFilename(clienteName)}.pdf`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isGenerating}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#021359] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(2,19,89,0.22)] transition hover:-translate-y-0.5 hover:bg-[#031a78] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {isGenerating ? "Preparando PDF" : "Descargar PDF"}
    </button>
  );
}
