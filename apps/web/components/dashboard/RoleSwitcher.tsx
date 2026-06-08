"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/components/ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBrowserCookie, setBrowserCookie } from "@/lib/api/browser-client";
import { authClient } from "@/lib/api/auth-client";
import {
  buildEffectiveScopeAwareUser,
  parseStoredScopeAwareUser,
} from "@/lib/access-scope";

const ROLES = ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR", "OPERADOR"];

export function RoleSwitcher() {
  const isDev = process.env.NODE_ENV !== 'production';
  const [currentRole, setCurrentRole] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // setTimeout defers the state update, fixing the react-hooks/set-state-in-effect lint error
    const timer = setTimeout(() => {
      setIsMounted(true);

      if (!isDev) return;

      let roleFound = false;

      const cookieRole = getBrowserCookie("x-test-role");

      if (cookieRole) {
        setCurrentRole(cookieRole);
        roleFound = true;
      }

      if (!roleFound) {
        const storedUser = parseStoredScopeAwareUser(localStorage.getItem("user"));
        const effectiveUser = buildEffectiveScopeAwareUser(storedUser, cookieRole);

        if (effectiveUser?.role) {
          setCurrentRole(effectiveUser.role);
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isDev]);

  const handleRoleChange = async (role: string) => {
    setCurrentRole(role);

    // Defer the impure DOM mutations to next tick using setTimeout
    // to satisfy React strict mode / concurrent mode purity requirements
    setTimeout(async () => {
      // Update local storage for immediate UI feedback if needed
      const userData = localStorage.getItem("user");
      if (userData) {
        try {
          const user = parseStoredScopeAwareUser(userData);
          const nextUser = buildEffectiveScopeAwareUser(
            user,
            role,
          );

          if (nextUser) {
            localStorage.setItem("user", JSON.stringify(nextUser));
          }
        } catch (_e) { /* ignore */ }
      }

      try {
        await authClient.updateTestRole(role);
        setBrowserCookie("x-test-role", role, {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        window.location.reload();
      } catch (error) {
        console.error("Error updating role:", error);
      }
    }, 0);
  };

  if (!isMounted || !isDev) return <div className="hidden" aria-hidden="true" />;

  return (
    <div className="flex items-center gap-3 border-l border-zinc-200 dark:border-zinc-800 pl-4 ml-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="group flex items-center gap-3 rounded-xl py-1.5 px-3 transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20 outline-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shadow-sm transition-transform group-hover:scale-110 dark:bg-amber-900/30 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-zinc-200 leading-tight">
                Modo Dev
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                  {currentRole || "Sin Rol"}
                </span>
                <ChevronsUpDown className="h-3 w-3 text-zinc-400" />
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-48 rounded-2xl border-2 border-zinc-100 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          align="start"
          sideOffset={8}
        >
          {ROLES.map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() => handleRoleChange(role)}
              className={cn(
                "flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer",
                role === currentRole
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
              )}
            >
              {role}
              {role === currentRole && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
