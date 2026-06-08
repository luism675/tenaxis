"use client";

import React, { useState, useEffect } from "react";
import { 
  MoreVertical, 
  Eye, 
  Edit2, 
  Trash2, 
  Briefcase as BriefcaseIcon, 
  MapPin, 
  Clock, 
  CreditCard 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";
import { formatBogotaDate } from "@/utils/date-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { serviciosClient } from "@/lib/api/servicios-client";
import { WidgetConfigurator } from "./WidgetConfigurator";

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "relative overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md",
    className
  )}>
    {children}
  </div>
);

export interface RecentService {
  id: string;
  servicioEspecifico?: string;
  servicio?: { nombre: string };
  fechaVisita?: string;
  cliente?: { razonSocial?: string; nombre?: string };
  tecnico?: { 
    user?: { nombre: string; apellido?: string };
    nombre?: string;
  };
  valorCotizado?: number;
  estadoServicio: string;
  direccionTexto?: string;
}

export function RecentActivity({ 
  recentServices, 
  loading, 
  refreshData,
  isConfiguring,
  onMoveUp,
  onMoveDown,
  onHide
}: { 
  recentServices: RecentService[]; 
  loading: boolean;
  refreshData: () => void;
  isConfiguring?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onHide?: () => void;
}) {
  const router = useRouter();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedServicio, setSelectedServicio] = useState<RecentService | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (!selectedServicio) return;

    setIsDeleting(true);
    const toastId = toast.loading("Eliminando orden de servicio...");

    try {
      await serviciosClient.delete(selectedServicio.id);
      toast.success("Orden eliminada correctamente", { id: toastId });
      setIsDeleteModalOpen(false);
      refreshData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Ocurrió un error inesperado al eliminar", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="relative space-y-6">
      <h3 className="text-xl font-black uppercase tracking-widest text-foreground pl-2 border-l-4 border-[#01ADFB]">
        Registro <span className="text-[#01ADFB]">Operacional</span>
      </h3>
      
      <GlassCard>
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">Actividad Reciente</h2>
            <p className="text-sm font-medium text-muted-foreground">Últimas operaciones realizadas en el sistema</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/servicios')}
            className="text-xs font-black uppercase tracking-widest text-[#01ADFB] hover:underline transition-all"
          >
            Ver Todo el Historial
          </button>
        </div>

        <div className="mt-6 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <th className="pb-4 pl-2">Servicio</th>
                <th className="pb-4">Cliente</th>
                <th className="pb-4">Técnico</th>
                <th className="pb-4">Monto</th>
                <th className="pb-4">Estado</th>
                <th className="pb-4 text-right pr-2">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm font-bold text-muted-foreground">Cargando actividad...</td>
                </tr>
              ) : recentServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm font-bold text-muted-foreground">No hay actividad reciente</td>
                </tr>
              ) : recentServices.map((service) => (
                <tr
                  key={service.id}
                  className="group transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    if (isConfiguring) return;
                    setSelectedServicio(service);
                    setIsModalOpen(true);
                  }}
                >
                  <td className="py-4 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#01ADFB]/10 text-[#01ADFB]">
                        <BriefcaseIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground truncate max-w-[150px]">
                          {service.servicioEspecifico || service.servicio?.nombre || "Servicio General"}
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground">
                          {service.fechaVisita ? formatBogotaDate(service.fechaVisita) : 'Pendiente'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-sm font-medium text-muted-foreground">
                    {service.cliente?.razonSocial || service.cliente?.nombre || "N/A"}
                  </td>
                  <td className="py-4 text-sm font-medium text-muted-foreground">
                    {service.tecnico?.user?.nombre
                      ? `${service.tecnico.user.nombre} ${service.tecnico.user.apellido || ''}`.trim()
                      : service.tecnico?.nombre || "Sin asignar"}
                  </td>
                  <td className="py-4 text-sm font-black text-foreground">
                    ${(service.valorCotizado || 0).toLocaleString()}
                  </td>
                  <td className="py-4">
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                      (service.estadoServicio === "LIQUIDADO" || service.estadoServicio === "TECNICO_FINALIZO")
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    )}>
                      {(service.estadoServicio === "LIQUIDADO" || service.estadoServicio === "TECNICO_FINALIZO") ? "Completado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="py-4 text-right pr-2 relative">
                    <button
                      disabled={isConfiguring}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === service.id ? null : service.id);
                      }}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {activeDropdown === service.id && !isConfiguring && (
                      <div
                        className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-border bg-card p-2 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setSelectedServicio(service);
                            setIsModalOpen(true);
                            setActiveDropdown(null);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                          Ver Detalles
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/servicios/${service.id}/editar?returnTo=/dashboard`)}
                          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Edit2 className="h-4 w-4" />
                          Editar
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                          onClick={() => {
                            setSelectedServicio(service);
                            setIsDeleteModalOpen(true);
                            setActiveDropdown(null);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {isConfiguring && <WidgetConfigurator onMoveUp={onMoveUp} onMoveDown={onMoveDown} onHide={onHide || (() => {})} />}

      {/* Modals */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight text-foreground uppercase">Detalles del Servicio</DialogTitle>
            <DialogDescription className="text-muted-foreground">Información detallada de la orden de servicio seleccionada.</DialogDescription>
          </DialogHeader>

          {selectedServicio && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Servicio</Label>
                  <p className="mt-1 text-sm font-bold text-foreground">{selectedServicio.servicioEspecifico || selectedServicio.servicio?.nombre || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</Label>
                  <p className="mt-1 text-sm font-bold text-foreground">{selectedServicio.cliente?.razonSocial || selectedServicio.cliente?.nombre || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ubicación</Label>
                  <div className="mt-1 flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-[#01ADFB]" />
                    <p className="text-sm font-bold text-foreground">{selectedServicio.direccionTexto || "Sin dirección registrada"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Técnico Asignado</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {selectedServicio.tecnico?.user?.nombre?.charAt(0) || 'T'}
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {selectedServicio.tecnico?.user?.nombre
                        ? `${selectedServicio.tecnico.user.nombre} ${selectedServicio.tecnico.user.apellido || ''}`.trim()
                        : "Sin asignar"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-bold text-foreground">{selectedServicio.fechaVisita ? formatBogotaDate(selectedServicio.fechaVisita) : 'Pendiente'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-black text-foreground">${(selectedServicio.valorCotizado || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</Label>
                  <div className="mt-2">
                    <span className={cn(
                      "inline-flex rounded-xl border border-border bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                      (selectedServicio.estadoServicio === "LIQUIDADO" || selectedServicio.estadoServicio === "TECNICO_FINALIZO")
                        ? "text-emerald-600"
                        : "text-amber-600"
                    )}>
                      {selectedServicio.estadoServicio}
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 mt-4 flex items-center justify-between gap-4 border-t border-border pt-6">
                <Button variant="outline" className="flex-1 rounded-2xl border-border bg-card font-black uppercase tracking-widest text-muted-foreground hover:bg-muted" onClick={() => setIsModalOpen(false)}>Cerrar</Button>
                <Button className="flex-1 rounded-2xl bg-[#01ADFB] font-black uppercase tracking-widest text-white shadow-lg shadow-[#01ADFB]/20 transition-transform hover:scale-105 active:scale-95" onClick={() => {
                  router.push(`/dashboard/servicios/${selectedServicio.id}/editar?returnTo=/dashboard`);
                }}>Gestionar Orden</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground uppercase">Confirmar Eliminación</DialogTitle>
            <DialogDescription className="text-muted-foreground">¿Estás seguro de que deseas eliminar esta orden de servicio? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-xl border-border bg-card font-bold text-muted-foreground hover:bg-muted"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-destructive/20 transition-transform active:scale-95"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar Orden"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
