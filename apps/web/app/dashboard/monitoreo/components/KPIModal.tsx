"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { LucideIcon } from "lucide-react";

interface KPIModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export function KPIModal({ 
  isOpen, 
  onOpenChange, 
  title, 
  icon: Icon,
  children 
}: KPIModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl flex flex-col p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-border bg-muted/30 space-y-0">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {children}
        </div>
        <div className="p-4 border-t border-border bg-muted/10 text-center">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Información en tiempo real</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
