"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, Loader2 } from "lucide-react";

interface ExportRangeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (range: { from: Date; to: Date }) => Promise<void>;
}

export function ExportRangeModal({
  isOpen,
  onOpenChange,
  onExport,
}: ExportRangeModalProps) {
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!fromDate || !toDate) return;
    setIsExporting(true);
    try {
      await onExport({ from: fromDate, to: toDate });
      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };

  const isValidRange = fromDate && toDate && fromDate <= toDate;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] w-[95vw] max-h-[90vh] overflow-y-auto border-2 border-border/50 bg-card/95 backdrop-blur-xl rounded-[2rem] p-4 sm:p-6 gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-[#01ADFB]/10 rounded-xl">
              <Download className="h-5 w-5 text-[#01ADFB]" />
            </div>
            Exportar Rango
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium pt-2 text-sm">
            Selecciona el periodo para descargar el reporte en Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 sm:py-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                Fecha Inicial
              </label>
              <div className="relative">
                <DatePicker 
                  date={fromDate} 
                  onChange={setFromDate} 
                  placeholder="Inicio"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                Fecha Final
              </label>
              <div className="relative">
                <DatePicker 
                  date={toDate} 
                  onChange={setToDate} 
                  placeholder="Fin"
                />
              </div>
            </div>
          </div>

          {!isValidRange && fromDate && toDate && (
            <div className="text-[10px] font-bold text-destructive uppercase text-center bg-destructive/10 py-3 rounded-xl border border-destructive/20">
              La fecha final debe ser posterior a la inicial
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-6 border-t border-border/50 mt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-12 rounded-xl font-black uppercase tracking-widest text-[10px] order-2 sm:order-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={!isValidRange || isExporting}
            className="w-full sm:w-auto h-12 px-8 bg-[#01ADFB] hover:bg-[#01ADFB]/90 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#01ADFB]/20 transition-all active:scale-95 order-1 sm:order-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                Generar Reporte
                <Download className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
