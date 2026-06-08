"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileJson, ShieldCheck, ShieldAlert } from "lucide-react";
import { ComparisonTable } from "./ComparisonTable";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { formatBogotaDateTime } from "@/utils/date-utils";

import { Audit } from "../types";

interface AuditDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  audit: Audit;
}

export function AuditDetailModal({ isOpen, onOpenChange, audit }: AuditDetailModalProps) {
  if (!audit) return null;
  const isSuccess = !audit.accion.includes('FAILED');
  const responsibleName = `${audit.membership?.user?.nombre ?? ""} ${audit.membership?.user?.apellido ?? ""}`.trim() || "Sistema";
  const responsibleUsername = audit.membership?.username ? `@${audit.membership.username}` : "@sistema";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl flex flex-col p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-border bg-muted/30 space-y-0">
          <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg", isSuccess ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
              <FileJson className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground text-left">Detalles del Cambio</DialogTitle>
              <DialogDescription className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-left">
                {audit.entidad} • #{audit.entidadId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-6 bg-muted/20 rounded-3xl border border-border space-y-4">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-accent" />Resumen de Operación</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Acción Realizada</p>
                  <p className="font-black text-foreground text-lg uppercase tracking-tight">{audit.accion.split('_')[0]}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Estado</p>
                  <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border", isSuccess ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                    {isSuccess ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                    {isSuccess ? "EXITOSA" : "FALLIDA"}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Fecha y Hora</p>
                  <p className="font-bold text-foreground text-sm">{formatBogotaDateTime(audit.createdAt, "es-CO")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Ubicación IP</p>
                  <p className="font-bold text-foreground text-sm">{(audit.metadata?.ip as string) || 'Desconocida'}</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-muted/20 rounded-3xl border border-border space-y-4">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-accent" />Responsable</h4>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent text-lg font-black shadow-inner">{audit.membership?.user?.nombre?.[0] ?? "S"}</div>
                <div>
                  <p className="font-black text-foreground uppercase text-sm">{responsibleName}</p>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{responsibleUsername}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-accent" />Comparativa de Datos</h4>
            <ComparisonTable detalles={audit.detalles} />
          </div>
        </div>
        <div className="p-6 border-t border-border bg-muted/10">
          <Button onClick={() => onOpenChange(false)} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-foreground text-background hover:opacity-90 transition-all">Cerrar Detalles</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
