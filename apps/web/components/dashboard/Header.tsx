"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Bell, User, Menu, ArrowRight, Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFollowUpNotifications } from "@/hooks/use-follow-up-notifications";
import { buildPendingFollowUpsHref } from "@/lib/api/follow-up-notifications-client";
import { RoleSwitcher } from "./RoleSwitcher";
import { ModeToggle } from "./ModeToggle";

type UserProfile = {
  nombre: string;
  apellido: string;
  role?: string;
};

const ROLE_LABELS: Record<string, string> = {
  SU_ADMIN: "Super Usuario",
  ADMIN: "Administrador",
  COORDINADOR: "Coordinador",
  ASESOR: "Asesor",
  OPERADOR: "Operador",
};

const formatDueLabel = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(parsed);
};

export function Header({ onMenuClick, isSidebarOpen }: { onMenuClick?: () => void; isSidebarOpen?: boolean }) {
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("Invitado");
  const [searchValue, setSearchValue] = useState("");
  const [jokeState, setJokeState] = useState<"none" | "six" | "six-seven">("none");
  const { summary, isLoading } = useFollowUpNotifications();
  const totalPending = summary?.totalPending ?? 0;
  const overdueCount = summary?.overdueCount ?? 0;
  const previewItems = summary?.items?.slice(0, 5) ?? [];
  const pendingHref = buildPendingFollowUpsHref();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase();
    setSearchValue(val);

    if (val === "6") {
      setJokeState("six");
    } else if (val.trim() === "6 7" || val === "67" || val.includes("six seven")) {
      setJokeState("six-seven");
      // Reset after animation
      setTimeout(() => {
        setJokeState("none");
      }, 3500);
    } else {
      setJokeState("none");
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData || userData === "undefined") return;

    try {
      const user = JSON.parse(userData) as UserProfile;
      const fullName = `${user.nombre} ${user.apellido}`;
      const roleLabel = user.role ? ROLE_LABELS[user.role] || user.role : "Invitado";
      
      const frameId = requestAnimationFrame(() => {
        setUserName(fullName);
        setUserRole(roleLabel);
      });

      return () => cancelAnimationFrame(frameId);
    } catch (e) {
      console.error("Error parsing user data", e);
    }
  }, []);

  return (
    <header className={`sticky top-0 z-30 flex h-20 lg:h-24 w-full items-center justify-between px-6 lg:px-10 border-b border-border bg-background/80 backdrop-blur-md transition-all ${
      jokeState === "six-seven" ? "animate-[shake_0.2s_ease-in-out_infinite] border-[#00FBFF]" : ""
    }`}>
      <div className="flex items-center gap-4 lg:gap-6 flex-1 max-w-2xl">
        {/* menu toggle */}
        <button 
          onClick={onMenuClick}
          aria-label={isSidebarOpen ? "Cerrar menú" : "Abrir menú"}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-card text-foreground transition-all hover:bg-muted shadow-sm border border-border hover:scale-105 active:scale-95"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative w-full group hidden sm:block">
          {/* SIX SEVEN MEME OVERLAY */}
          {jokeState === "six" && (
            <div className="absolute left-12 -top-6 text-[#00FBFF] font-bold italic animate-pulse tracking-tighter">
              SIX... 🏀
            </div>
          )}
          
          {jokeState === "six-seven" && (
            <div className="absolute inset-0 -top-24 flex flex-col items-center justify-center z-50 pointer-events-none">
              <div className="flex gap-12 mb-2 relative">
                <span className="text-5xl animate-[scale-hand_0.3s_ease-in-out_infinite] filter drop-shadow-[0_0_10px_#00FBFF]">🖐️</span>
                <span className="text-5xl animate-[scale-hand_0.3s_ease-in-out_infinite_reverse] filter drop-shadow-[0_0_10px_#7B2CBF]">🖐️</span>
                {/* Floating particles */}
                <span className="absolute -left-20 top-0 text-2xl animate-ping">🏀</span>
                <span className="absolute -right-20 top-0 text-2xl animate-ping [animation-delay:0.2s]">🔥</span>
              </div>
              <div className="relative group">
                {/* Chromatic Aberration Layers */}
                <div className="absolute inset-0 text-[#FF00FF] translate-x-1 translate-y-1 opacity-70 blur-[1px] text-5xl font-bold italic tracking-tighter animate-[bass-boost_0.15s_ease-in-out_infinite_reverse]">
                  SIX SEVEN!
                </div>
                <div className="absolute inset-0 text-[#00FFFF] -translate-x-1 -translate-y-1 opacity-70 blur-[1px] text-5xl font-bold italic tracking-tighter animate-[bass-boost_0.15s_ease-in-out_infinite]">
                  SIX SEVEN!
                </div>
                <div className="relative bg-black/90 text-white px-8 py-3 rounded-xl text-5xl font-bold italic tracking-tighter border-y-4 border-[#00FBFF] shadow-[0_0_60px_rgba(0,251,255,0.6)] animate-[bass-boost_0.15s_ease-in-out_infinite]">
                  SIX SEVEN! 🗣️
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-1 w-12 bg-[#00FBFF] animate-pulse rounded-full" />
                <div className="h-1 w-12 bg-[#7B2CBF] animate-pulse rounded-full" />
                <div className="h-1 w-12 bg-[#00FBFF] animate-pulse rounded-full" />
              </div>
            </div>
          )}

          <Search className={`absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-all duration-300 ${
            jokeState === "six-seven" 
              ? "text-[#00FBFF] scale-150" 
              : "text-muted-foreground group-focus-within:text-[#01ADFB]"
          }`} />
          <Input
            type="search"
            name="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Buscar en el sistema..."
            className={`h-12 lg:h-13 w-full border-none bg-card text-foreground pl-12 pr-4 rounded-2xl focus:ring-2 transition-all duration-200 text-sm font-bold shadow-sm ${
              jokeState === "six-seven" 
                ? "focus:ring-[#00FBFF] bg-black text-white scale-[1.05] ring-4 ring-[#00FBFF]/50" 
                : "placeholder:text-muted-foreground focus:ring-[#01ADFB]/20"
            }`}
            autoComplete="off"
          />
        </div>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px) rotate(-1deg); }
          75% { transform: translateX(4px) rotate(1deg); }
        }
        @keyframes bass-boost {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.1); filter: brightness(1.5); }
        }
        @keyframes scale-hand {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>

      <div className="flex items-center gap-4 lg:gap-6 pl-4 lg:pl-6 ml-4">
        <div className="hidden md:block">
          <RoleSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Ver notificaciones"
                className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-card text-muted-foreground transition-all hover:bg-muted hover:text-[#01ADFB] border border-border hover:scale-105 shadow-sm"
              >
                <Bell className="h-5 w-5" />
                {totalPending > 0 ? (
                  <span
                    className={`absolute -right-1.5 -top-1.5 min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-lg ${
                      overdueCount > 0 ? "bg-rose-500" : "bg-[#01ADFB]"
                    }`}
                  >
                    {totalPending > 99 ? "99+" : totalPending}
                  </span>
                ) : isLoading ? (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#01ADFB] ring-2 ring-background animate-pulse" />
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="w-[380px] rounded-3xl border-border bg-background p-0 shadow-2xl"
            >
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#01ADFB]">
                      Seguimientos live
                    </p>
                    <h3 className="text-base font-black tracking-tight text-foreground">
                      {summary?.scope === "team" ? "Pendientes del equipo" : "Mis acciones pendientes"}
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground">
                      {totalPending > 0
                        ? `${totalPending} acción${totalPending === 1 ? "" : "es"} activa${totalPending === 1 ? "" : "s"}`
                        : "No tenés acciones pendientes ahora mismo."}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/notificaciones"
                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Ver feed
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-border/70 bg-card px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Total
                    </p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-foreground">
                      {totalPending}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200/60 bg-rose-50 px-3 py-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-300">
                      Vencidas
                    </p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-rose-700 dark:text-rose-100">
                      {overdueCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/60 bg-amber-50 px-3 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                      Hoy
                    </p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-amber-700 dark:text-amber-100">
                      {summary?.todayCount ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator />

              <div className="max-h-[320px] space-y-2 overflow-y-auto p-3">
                {previewItems.length > 0 ? (
                  previewItems.map((item) => (
                    <Link
                      key={item.id}
                      href={pendingHref}
                      className="block rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] ${
                                item.isOverdue
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                                  : "bg-[#01ADFB]/10 text-[#01ADFB]"
                              }`}
                            >
                              {item.isOverdue ? "Vencida" : "Pendiente"}
                            </span>
                            <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                              {item.followUpType}
                            </span>
                          </div>
                          <p className="truncate text-sm font-black tracking-tight text-foreground">
                            {item.cliente}
                          </p>
                          <p className="truncate text-xs font-medium text-muted-foreground">
                            {item.servicio}
                            {item.responsibleName ? ` · ${item.responsibleName}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{formatDueLabel(item.dueAt)}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
                    <p className="text-sm font-black tracking-tight text-foreground">
                      Todo bajo control
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      No hay acciones pendientes para mostrar.
                    </p>
                  </div>
                )}
              </div>

              <DropdownMenuSeparator />

              <div className="flex items-center justify-between gap-3 p-3">
                <Link
                  href="/dashboard/notificaciones"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-2xl border border-border bg-card px-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Abrir centro
                </Link>
                <Link
                  href={pendingHref}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-2xl bg-[#01ADFB] px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-transform hover:scale-[1.01]"
                >
                  Ver pendientes
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 py-1.5 px-2 rounded-2xl bg-card border border-border hover:shadow-md transition-all cursor-pointer group/user">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#021359] to-[#01ADFB] text-white shadow-md transition-transform group-hover:rotate-12">
            <User className="h-5 w-5" />
          </div>
          <div className="hidden text-left lg:block pr-2">
            <p className="text-[13px] font-bold text-foreground leading-tight">
              {userName || "Cargando..."}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#01ADFB] mt-0.5">
              {userRole}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
