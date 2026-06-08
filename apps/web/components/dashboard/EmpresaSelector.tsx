"use client";

import React, { useEffect, useState } from "react";
import { Building2, ChevronsUpDown, Check } from "lucide-react";
import {
  getScopedRole,
  isEmpresaSelectionLocked,
  resolveAvailableEmpresaIds,
  type ScopeAwareUser,
} from "@/lib/access-scope";
import { authClient } from "@/lib/api/auth-client";
import { getBrowserCookie, setBrowserCookie } from "@/lib/api/browser-client";
import { enterpriseClient } from "@/lib/api/enterprise-client";
import { cn } from "@/components/ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Empresa {
  id: string;
  nombre: string;
}

export function EmpresaSelector() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [currentEmpresaId, setCurrentEmpresaId] = useState<string>("");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEmpresas() {
      try {
        const [result, profile] = await Promise.all([
          enterpriseClient.getAll(),
          authClient.getProfile(),
        ]);
        let items: Empresa[] = [];
        
        if (result && typeof result === 'object' && 'items' in result) {
          items = (result as { items: Empresa[] }).items;
        } else {
          items = Array.isArray(result) ? (result as Empresa[]) : [];
        }

        const allowedEmpresaIds = resolveAvailableEmpresaIds(profile as ScopeAwareUser | null);
        const scopedItems =
          allowedEmpresaIds.length > 0
            ? items.filter((empresa) => allowedEmpresaIds.includes(empresa.id))
            : items;
        const scopedRole = getScopedRole(profile?.role);
        const shouldLockSelection =
          isEmpresaSelectionLocked(profile) ||
          ((scopedRole === "COORDINADOR" || scopedRole === "ASESOR") && scopedItems.length <= 1);

        setEmpresas(scopedItems);
        setIsReadOnly(shouldLockSelection);

        const cookieId = getBrowserCookie("x-enterprise-id");

        if (cookieId && scopedItems.find((e: Empresa) => e.id === cookieId)) {
          setCurrentEmpresaId(cookieId);
        } else if (scopedItems.length > 0) {
          const firstId = scopedItems[0].id;
          setCurrentEmpresaId(firstId);
          updateEnterpriseCookie(firstId);
        }
      } catch (error) {
        console.error("Error loading empresas:", error);
      } finally {
        setLoading(false);
      }
    }

    loadEmpresas();
  }, []);

  const updateEnterpriseCookie = (id: string) => {
    setBrowserCookie("x-enterprise-id", id, {
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    localStorage.setItem("current-enterprise-id", id);
  };

  const handleSelect = (id: string) => {
    if (id === currentEmpresaId) return;
    setCurrentEmpresaId(id);
    updateEnterpriseCookie(id);
    window.location.assign(window.location.pathname);
  };

  if (loading) {
    return (
      <div className="px-2">
        <div className="h-14 w-full animate-pulse rounded-2xl bg-white/5 border border-white/10" />
      </div>
    );
  }

  if (empresas.length === 0) return null;

  const currentEmpresa = empresas.find((empresa) => empresa.id === currentEmpresaId) || empresas[0];

  if (isReadOnly) {
    return (
      <div className="">
        <div className="group relative pt-2">
          <div className="absolute -top-1 left-4 z-20 bg-[#021359] px-2 dark:bg-sidebar">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#01ADFB]">
              Empresa Asignada
            </p>
          </div>
          <div
            className={cn(
              "relative flex h-14 w-full items-center rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-left text-sm font-bold text-[#F8FAFC]",
              "shadow-sm"
            )}
            aria-label="Empresa asignada"
          >
            <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#01ADFB]" />
            <span className="truncate">{currentEmpresa?.nombre}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="group relative pt-2">
        {/* Label flotante con fondo que coincide con el sidebar */}
        <div className="absolute -top-1 left-4 z-20 bg-[#021359] px-2 dark:bg-sidebar">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#01ADFB]">
            Empresa Actual
          </p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "relative h-14 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-10 text-left text-sm font-bold text-[#F8FAFC] outline-none transition-all",
                "hover:border-[#01ADFB]/50 hover:bg-white/10 active:scale-[0.98]",
                "shadow-sm group-hover:shadow-md flex items-center"
              )}
            >
              <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#01ADFB] transition-transform group-hover:scale-110" />
              <span className="truncate">{currentEmpresa?.nombre}</span>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#F8FAFC]/40">
                <ChevronsUpDown className="h-4 w-4" />
              </div>
            </button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent 
            className="w-64 rounded-2xl border border-[#706F71]/20 bg-white p-2 shadow-2xl dark:bg-zinc-900"
            align="start"
            sideOffset={8}
          >
            <div className="px-3 py-2 mb-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#706F71]">Cambiar de Unidad</p>
            </div>
            {empresas.map((empresa) => (
              <DropdownMenuItem
                key={empresa.id}
                onClick={() => handleSelect(empresa.id)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition-colors cursor-pointer mb-1 last:mb-0",
                  empresa.id === currentEmpresaId
                    ? "bg-[#0091D5] text-white"
                    : "text-[#021359] hover:bg-[#706F71]/5 dark:text-zinc-200 dark:hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Building2 className={cn("h-4 w-4", empresa.id === currentEmpresaId ? "text-white" : "text-[#706F71]")} />
                  {empresa.nombre}
                </div>
                {empresa.id === currentEmpresaId && <Check className="h-4 w-4 text-white animate-in zoom-in-50" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
