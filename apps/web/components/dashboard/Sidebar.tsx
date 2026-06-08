"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/utils";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Bell,
  Building2,
  LucideIcon,
  Contact,
  Package,
  Activity,
  MessageSquare,
  MapPin,
  Award,
} from "lucide-react";
import { canAccessTenantsView, getScopedRole, type ScopedRole } from "@/lib/access-scope";
import { deleteBrowserCookie } from "@/lib/api/browser-client";
import { authClient } from "@/lib/api/auth-client";
import { useFollowUpNotifications } from "@/hooks/use-follow-up-notifications";
import { EmpresaSelector } from "./EmpresaSelector";

type SidebarChildItem = {
  title: string;
  icon: LucideIcon;
  href: string;
};

type SidebarMenuItem = {
  title: string;
  icon: LucideIcon;
  href?: string;
  baseHref?: string;
  role?: string;
  children?: SidebarChildItem[];
};

const menuItems: SidebarMenuItem[] = [
  {
    title: "Panel General",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Monitoreo",
    icon: Activity,
    href: "/dashboard/monitoreo",
  },
  {
    title: "WhatsApp",
    icon: MessageSquare,
    href: "/dashboard/whatsapp",
  },
  {
    title: "Solicitudes",
    icon: ShieldCheck,
    href: "/dashboard/solicitudes",
    role: "SU_ADMIN",
  },
  {
    title: "Clientes",
    icon: Contact,
    baseHref: "/dashboard/clientes",
    children: [
      {
        title: "Cartera",
        icon: Contact,
        href: "/dashboard/clientes",
      },
      {
        title: "Ranking",
        icon: Award,
        href: "/dashboard/clientes/ranking",
      },
    ],
  },
  {
    title: "Equipo de Trabajo",
    icon: Users,
    baseHref: "/dashboard/equipo-trabajo",
    children: [
      {
        title: "Usuarios",
        icon: Users,
        href: "/dashboard/equipo-trabajo/usuarios",
      },
      {
        title: "Tareas y Comunicación",
        icon: MessageSquare,
        href: "/dashboard/equipo-trabajo/tareas-y-comunicacion",
      },
      {
        title: "Ranking",
        icon: Award,
        href: "/dashboard/equipo-trabajo/ranking",
      },
    ],
  },
  {
    title: "Servicios",
    icon: Briefcase,
    baseHref: "/dashboard/servicios",
    children: [
      {
        title: "Órdenes",
        icon: ClipboardList,
        href: "/dashboard/servicios",
      },
      {
        title: "Rutas",
        icon: MapPin,
        href: "/dashboard/servicios/rutas",
      },
    ],
  },
  {
    title: "Cuenta de Cobro",
    icon: CreditCard,
    href: "/dashboard/cuenta-cobro",
  },
  {
    title: "Agenda",
    icon: Calendar,
    href: "/dashboard/agenda",
  },
  {
    title: "Insumos",
    icon: Package,
    href: "/dashboard/insumos",
  },
  {
    title: "Contabilidad",
    icon: CreditCard,
    href: "/dashboard/contabilidad",
  },
];

const secondaryItems = [
  {
    title: "Configuración",
    icon: Settings,
    href: "/dashboard/configuracion",
  },
  {
    title: "Notificaciones",
    icon: Bell,
    href: "/dashboard/notificaciones",
  },
  {
    title: "Tenants",
    icon: Building2,
    href: "/dashboard/tenants",
    isAdmin: true,
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [canViewTenants, setCanViewTenants] = useState(false);
  const [userRole, setUserRole] = useState<ScopedRole | null>(null);
  const [assignedEmpresaCount, setAssignedEmpresaCount] = useState<number>(0);
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>({});
  const { summary, isLoading: isLoadingNotifications } = useFollowUpNotifications();
  const pendingNotifications = summary?.totalPending ?? 0;

  useEffect(() => {
    let isMounted = true;

    async function loadScope() {
      try {
        const profile = await authClient.getProfile();
        if (!isMounted || !profile) return;

        setCanViewTenants(canAccessTenantsView(profile));
        setUserRole(getScopedRole(profile.role));
        setAssignedEmpresaCount(profile.empresaIds?.filter(Boolean).length || (profile.empresaId ? 1 : 0));
        return;
      } catch {
        // Fallback to localStorage if the profile request fails.
      }

      const userData = localStorage.getItem("user");
      if (!isMounted || !userData || userData === "undefined") {
        return;
      }

      try {
        const user = JSON.parse(userData);
        setCanViewTenants(canAccessTenantsView(user));
        setUserRole(getScopedRole(user.role));
        setAssignedEmpresaCount(user.empresaIds?.filter(Boolean).length || (user.empresaId ? 1 : 0));
      } catch {
        // ignore malformed cached user data
      }
    }

    loadScope();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await authClient.logout();
    } catch (error) {
      console.error("Error calling logout API:", error);
    }

    deleteBrowserCookie("access_token");
    deleteBrowserCookie("tenant-id");
    deleteBrowserCookie("x-enterprise-id");
    deleteBrowserCookie("x-test-role");

    localStorage.removeItem("user");
    localStorage.removeItem("current-enterprise-id");
    window.location.href = "/iniciar-sesion";
  };

  const visibleMenuItems = menuItems.filter(item => !item.role || item.role === userRole);
  const visibleSecondaryItems = secondaryItems.filter(
    (item) => !item.isAdmin || canViewTenants,
  );
  const showEmpresaSelector = userRole !== "ASESOR" || assignedEmpresaCount > 1;

  const toggleMenuGroup = (groupHref: string, isOpen: boolean) => {
    setOpenMenuGroups((current) => ({
      ...current,
      [groupHref]: !isOpen,
    }));
  };

  const isChildActive = (child: SidebarChildItem, siblings: SidebarChildItem[]) => {
    if (pathname === child.href) {
      return true;
    }

    const moreSpecificSiblingIsActive = siblings.some(
      (sibling) =>
        sibling.href !== child.href &&
        sibling.href.startsWith(`${child.href}/`) &&
        (pathname === sibling.href || pathname.startsWith(`${sibling.href}/`)),
    );

    return !moreSpecificSiblingIsActive && pathname.startsWith(`${child.href}/`);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen w-72 border-r border-white/10 bg-[#021359] p-6 transition-transform duration-300 dark:bg-sidebar",
        isOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Top Section: Logo & Empresa */}
          <div className="flex-shrink-0 space-y-10">
            {/* Logo */}
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3 px-4 group" onClick={onClose}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#01ADFB] text-white shadow-lg transition-transform group-hover:scale-105">
                  <Sparkles className="h-7 w-7" />
                </div>
                <span className="text-2xl font-bold tracking-tighter text-[#F8FAFC]">
                  Tenaxis
                </span>
              </Link>
              {/* Close button for mobile */}
              <button 
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#F8FAFC]/50 hover:bg-white/10 transition-colors shadow-sm border border-white/10 lg:hidden"
                aria-label="Cerrar menú"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
            </div>

            {/* Empresa Selector */}
            {showEmpresaSelector && (
              <div className="sidebar-empresa-selector-container">
                <EmpresaSelector />
              </div>
            )}
          </div>

          {/* Navigation - Flexible area with scroll */}
          <nav className="mt-10 flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-2 -mr-2">
            <div className="space-y-2">
              <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F8FAFC]/40">
                Principal
              </p>
              <div className="space-y-1">
                {visibleMenuItems.map((item) => {
                  const ItemIcon = item.icon;

                  if (item.children?.length && item.baseHref) {
                    const groupHref = item.baseHref;
                    const groupChildren = item.children;
                    const groupId = `sidebar-group-${groupHref.replaceAll("/", "-")}`;
                    const isGroupActive = pathname.startsWith(groupHref);
                    const isGroupOpen = openMenuGroups[groupHref] ?? isGroupActive;

                    return (
                      <div key={groupHref} className="space-y-1">
                        <button
                          type="button"
                          aria-expanded={isGroupOpen}
                          aria-controls={groupId}
                          onClick={() => toggleMenuGroup(groupHref, isGroupOpen)}
                          className={cn(
                            "group flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition-all duration-300",
                            isGroupActive
                              ? "bg-white/10 text-[#FFFFFF]"
                              : "text-[#CBD5E1] hover:bg-white/5 hover:text-[#01ADFB]"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <ItemIcon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isGroupActive ? "text-[#FFFFFF]" : "text-[#F8FAFC]/40 group-hover:text-[#01ADFB]")} />
                            <span className={cn("text-sm font-bold tracking-tight", isGroupActive ? "text-[#FFFFFF]" : "text-[#CBD5E1] group-hover:text-[#F8FAFC]")}>{item.title}</span>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform duration-300",
                              isGroupOpen && "rotate-90",
                              isGroupActive ? "text-[#FFFFFF]" : "text-[#F8FAFC]/40 group-hover:text-[#01ADFB]",
                            )}
                          />
                        </button>

                        {isGroupOpen && (
                          <div
                            id={groupId}
                            className="ml-5 space-y-1 border-l border-white/10 pl-3 animate-in fade-in slide-in-from-top-1"
                          >
                            {groupChildren.map((child) => {
                              const ChildIcon = child.icon;
                              const isActive = isChildActive(child, groupChildren);

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={onClose}
                                  className={cn(
                                    "group flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300",
                                    isActive
                                      ? "bg-[#01ADFB] text-[#FFFFFF] shadow-xl shadow-[#01ADFB]/20"
                                      : "text-[#CBD5E1] hover:bg-white/5 hover:text-[#01ADFB]"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <ChildIcon className={cn("h-4 w-4 transition-transform duration-300 group-hover:scale-110", isActive ? "text-[#FFFFFF]" : "text-[#F8FAFC]/40 group-hover:text-[#01ADFB]")} />
                                    <span className={cn("text-xs font-bold tracking-tight", isActive ? "text-[#FFFFFF]" : "text-[#CBD5E1] group-hover:text-[#F8FAFC]")}>{child.title}</span>
                                  </div>
                                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-[#FFFFFF] animate-in fade-in slide-in-from-left-2" />}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (!item.href) {
                    return null;
                  }

                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all duration-300",
                        isActive
                          ? "bg-[#01ADFB] text-[#FFFFFF] shadow-xl shadow-[#01ADFB]/20"
                          : "text-[#CBD5E1] hover:bg-white/5 hover:text-[#01ADFB]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-[#FFFFFF]" : "text-[#F8FAFC]/40 group-hover:text-[#01ADFB]")} />
                        <span className={cn("text-sm font-bold tracking-tight", isActive ? "text-[#FFFFFF]" : "text-[#CBD5E1] group-hover:text-[#F8FAFC]")}>{item.title}</span>
                      </div>
                      {isActive && <ChevronRight className="h-4 w-4 text-[#FFFFFF] animate-in fade-in slide-in-from-left-2" />}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F8FAFC]/40">
                Sistema
              </p>
              <div className="space-y-1">
                {visibleSecondaryItems.map((item) => {
                  const isActive = pathname === item.href;
                  const showNotificationsBadge = item.href === "/dashboard/notificaciones";
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex items-center justify-between rounded-2xl px-4 py-3.5 transition-all duration-300",
                        isActive
                          ? "bg-[#01ADFB] text-[#FFFFFF] shadow-xl shadow-[#01ADFB]/20"
                          : "text-[#CBD5E1] hover:bg-white/5 hover:text-[#01ADFB]"
                      )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-[#FFFFFF]" : "text-[#F8FAFC]/40 group-hover:text-[#01ADFB]")} />
                          <span className={cn("text-sm font-bold tracking-tight", isActive ? "text-[#FFFFFF]" : "text-[#CBD5E1] group-hover:text-[#F8FAFC]")}>{item.title}</span>
                        </div>
                        {showNotificationsBadge ? (
                          pendingNotifications > 0 ? (
                            <span className="inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-[#01ADFB] px-1.5 py-0.5 text-[10px] font-black text-white shadow-lg">
                              {pendingNotifications > 99 ? "99+" : pendingNotifications}
                            </span>
                          ) : isLoadingNotifications ? (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#01ADFB] animate-pulse" />
                          ) : null
                        ) : null}
                      </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Bottom Section: Profile/Logout - Always visible at the bottom */}
          <div className="flex-shrink-0 space-y-4 pt-6 mt-4 border-t border-white/5">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#01ADFB] text-white shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="overflow-hidden">
                  <p className="truncate text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]">
                    Plan Enterprise
                  </p>
                  <p className="text-[10px] font-bold text-[#F8FAFC]/40">
                    Renueva en 15 días
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="group flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-[#CBD5E1] transition-all hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-5 w-5 text-[#F8FAFC]/40 group-hover:text-red-400" />
              <span className="text-sm font-bold tracking-tight">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
