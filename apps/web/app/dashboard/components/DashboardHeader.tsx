"use client";

import React from "react";
import { Download, Plus, Settings2, Check, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardHeaderProps {
  isConfiguring: boolean;
  onToggleConfig: () => void;
  onExport: (format: "excel" | "pdf") => void;
}

export function DashboardHeader({ isConfiguring, onToggleConfig, onExport }: DashboardHeaderProps) {
  const router = useRouter();

  return (
    <div data-dashboard-header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-4xl font-black tracking-tight text-foreground lg:text-5xl">
          Dashboard <span className="text-[#01ADFB]">Analytics</span>
        </h1>
        <p className="text-lg font-medium text-muted-foreground">
          Bienvenido de nuevo. Aquí tienes un resumen del rendimiento actual.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleConfig}
          className={cn(
            "rounded-2xl border-border bg-card font-black uppercase tracking-widest text-foreground hover:bg-muted h-12",
            isConfiguring && "border-[#01ADFB] text-[#01ADFB] bg-[#01ADFB]/5"
          )}
        >
          {isConfiguring ? (
            <><Check className="mr-2 h-4 w-4" /> Finalizar</>
          ) : (
            <><Settings2 className="mr-2 h-4 w-4" /> Personalizar</>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-12 items-center gap-2 rounded-2xl bg-card px-6 text-sm font-black uppercase tracking-widest text-foreground shadow-sm border border-border transition-all hover:bg-muted">
              <Download className="h-4 w-4" />
              Reporte
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-2xl border-border bg-card p-2">
            <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Exportar Dashboard
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onExport("excel")}
              className="rounded-xl px-3 py-3 text-xs font-bold uppercase tracking-wide"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onExport("pdf")}
              className="rounded-xl px-3 py-3 text-xs font-bold uppercase tracking-wide"
            >
              <FileText className="h-4 w-4 text-rose-500" />
              PDF ejecutivo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <button
          onClick={() => router.push('/dashboard/servicios/nuevo')}
          className="flex h-12 items-center gap-2 rounded-2xl bg-[#01ADFB] px-6 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-[#01ADFB]/20 transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Nueva Orden
        </button>
      </div>
    </div>
  );
}
