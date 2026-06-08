"use client";

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { cn } from "@/components/ui/utils";
import { toBogotaYmd } from "@/utils/date-utils";

// Utility to sanitize strings from potential XSS or unwanted characters
export const sanitizeString = (str: string) => {
  if (!str) return "";
  // Basic sanitization: remove potential HTML tags and trim
  return str.replace(/<[^>]*>?/gm, '').trim();
};

export const GlassCard = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "relative overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md transition-all duration-300",
      onClick ? "hover:shadow-md hover:scale-[1.02] cursor-pointer active:scale-95" : "cursor-default",
      className
    )}
  >
    {children}
  </div>
);

/**
 * Utility to export data to Excel with multiple sheets
 */
export const exportToExcel = async (
  sheets: { name: string; data: Record<string, string | number | null | undefined>[] }[],
  filename: string
) => {
  const workbook = new ExcelJS.Workbook();

  sheets.forEach(({ name, data }) => {
    const worksheet = workbook.addWorksheet(name);
    if (!data || data.length === 0) {
      worksheet.addRow(["Sin datos disponibles"]);
      return;
    }
    
    const headers = Object.keys(data[0]!);
    
    // Header Row
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF18181B' },
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Data Rows
    data.forEach((item) => {
      const rowData = headers.map(header => item[header]);
      worksheet.addRow(rowData);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column, i) => {
      let maxLength = headers[i]?.length || 10;
      data.forEach(row => {
        const val = row[headers[i]!];
        if (val) {
          maxLength = Math.max(maxLength, String(val).length);
        }
      });
      column.width = maxLength < 12 ? 12 : maxLength + 2;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `${filename}_${toBogotaYmd()}.xlsx`);
};

/**
 * Utility to export data to CSV and trigger download
 */
export const exportToCSV = (data: Record<string, string | number | null | undefined>[], filename: string) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]!).join(",");
  const rows = data.map(obj => 
    Object.values(obj)
      .map(val => {
        const str = String(val ?? "").replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",")
  );

  const csvContent = [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${toBogotaYmd()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
