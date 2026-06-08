"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { configClient } from "@/lib/api/config-client";
import { enterpriseClient } from "@/lib/api/enterprise-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Save, X, Building, AlertTriangle, Trash2, Power, Loader2, Zap, ArrowLeft, Settings2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
  
  type Enterprise = {
    id: string;
    nombre: string;
    activo: boolean;
  };
  
  type Servicio = {
    id: string;
    nombre: string;
    activo: boolean;
    empresaId: string;
  };
  
  export function ConfigEmpresas() {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
    const [maxEmpresas, setMaxEmpresas] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Enterprise | null>(null);
    
    // Service management state
    const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Servicio | null>(null);
  
    const limitReached = enterprises.length >= maxEmpresas && maxEmpresas > 0;
  
    useEffect(() => {
      loadData();
    }, []);
  
    useEffect(() => {
      if (selectedEnterprise) {
        loadServicios(selectedEnterprise.id);
      }
    }, [selectedEnterprise]);
  
    async function loadData() {
      setLoading(true);
      try {
        const result = await enterpriseClient.getAll();
        // Si el backend devuelve el nuevo formato con items
        if (result && typeof result === 'object' && 'items' in result) {
          const enterpriseResult = result as unknown as { items: Enterprise[], maxEmpresas: number };
          setEnterprises(enterpriseResult.items);
          setMaxEmpresas(enterpriseResult.maxEmpresas);
        } else {
          setEnterprises(Array.isArray(result) ? (result as Enterprise[]) : []);
        }
      } catch (error) {
        console.error("Error loading enterprises:", error);
        toast.error("Error al cargar las empresas");
      } finally {
        setLoading(false);
      }
    }
  
    async function loadServicios(empresaId: string) {
      setLoading(true);
      try {
        const data = await configClient.getServicios(empresaId);
        setServicios(data as unknown as Servicio[]);
      } catch (error) {
        console.error("Error loading services:", error);
        toast.error("Error al cargar los servicios");
      } finally {
        setLoading(false);
      }
    }
  
    const handleOpenModal = (item: Enterprise | null = null) => {
      if (!item && limitReached) {
          toast.error("Has alcanzado el límite de empresas de tu plan");
          return;
      }
      setEditingItem(item);
      setIsModalOpen(true);
    };
  
    const handleCloseModal = () => {
      setEditingItem(null);
      setIsModalOpen(false);
    };
  
    const handleOpenServiceModal = (item: Servicio | null = null) => {
      setEditingService(item);
      setIsServiceModalOpen(true);
    };
  
    const handleCloseServiceModal = () => {
      setEditingService(null);
      setIsServiceModalOpen(false);
    };
  
    const handleToggleStatus = async (item: Enterprise) => {
      setActionLoading(item.id);
      try {
        await enterpriseClient.update(item.id, { activo: !item.activo });
        toast.success(`Empresa ${!item.activo ? 'activada' : 'desactivada'}`);
        loadData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al cambiar estado");
      } finally {
        setActionLoading(null);
      }
    };
  
    const handleToggleServiceStatus = async (item: Servicio) => {
      setActionLoading(item.id);
      try {
        await configClient.updateServicio(item.id, { activo: !item.activo });
        toast.success(`Servicio ${!item.activo ? 'activado' : 'desactivado'}`);
        if (selectedEnterprise) loadServicios(selectedEnterprise.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al cambiar estado");
      } finally {
        setActionLoading(null);
      }
    };
  
    const handleDelete = async (item: Enterprise) => {
      if (!confirm(`¿Estás seguro de eliminar la empresa "${item.nombre}"?`)) return;
      
      setActionLoading(item.id);
      try {
        await enterpriseClient.delete(item.id);
        toast.success("Empresa eliminada");
        loadData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al eliminar empresa");
      } finally {
        setActionLoading(null);
      }
    };
  
    const handleDeleteService = async (item: Servicio) => {
      if (!confirm(`¿Estás seguro de eliminar el servicio "${item.nombre}"?`)) return;
      
      setActionLoading(item.id);
      try {
        await configClient.deleteServicio(item.id);
        toast.success("Servicio eliminado");
        if (selectedEnterprise) loadServicios(selectedEnterprise.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al eliminar servicio");
      } finally {
        setActionLoading(null);
      }
    };
  
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const data = {
          nombre: formData.get('nombre') as string
      };
  
      try {
        if (editingItem) {
          await enterpriseClient.update(editingItem.id, data);
          toast.success("Empresa actualizada");
        } else {
          await enterpriseClient.create(data);
          toast.success("Empresa creada");
        }
        loadData();
        handleCloseModal();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error al guardar la empresa";
        toast.error(message);
      }
    };
  
    const handleSubmitService = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedEnterprise) return;
      
      const formData = new FormData(e.currentTarget);
      const data = {
          nombre: formData.get('nombre') as string,
          empresaId: selectedEnterprise.id
      };
  
      try {
        if (editingService) {
          await configClient.updateServicio(editingService.id, { nombre: data.nombre });
          toast.success("Servicio actualizado");
        } else {
          await configClient.createServicio(data);
          toast.success("Servicio creado");
        }
        loadServicios(selectedEnterprise.id);
        handleCloseServiceModal();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Error al guardar el servicio";
        toast.error(message);
      }
    };
  
    if (selectedEnterprise) {
      return (
        <Card className="border border-border bg-card shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4 border-b border-border bg-card">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedEnterprise(null)}
                className="h-8 w-8 rounded-full hover:bg-white dark:hover:bg-zinc-800 transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <CardTitle className="text-[13px] uppercase tracking-[0.12em] font-medium tracking-tight dark:text-zinc-100 flex items-center gap-2">
                  Servicios de <span className="text-[#01ADFB]">{selectedEnterprise.nombre}</span>
                </CardTitle>
                <CardDescription className="mt-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                  Define el catálogo de servicios específicos para esta empresa
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => handleOpenServiceModal()} 
              className="bg-[#01ADFB] hover:bg-blue-700 text-white dark:text-zinc-300 font-medium text-[10px] rounded-md gap-2 h-11 px-3 shadow-lg shadow-[#01ADFB]/20 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="h-4 w-4" /> AGREGAR SERVICIO
            </Button>
          </CardHeader>
          <CardContent className="p-4 bg-card">
            {loading ? (
              <div className="flex h-60 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-4 border-azul-1/20 border-t-azul-1 rounded-full animate-spin" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 animate-pulse">Cargando servicios...</span>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {servicios.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3 bg-card rounded-lg border border-border hover:border-[#01ADFB]/30 transition-all group">
                    <div className="flex gap-4 items-center">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center border border-border shadow-sm group-hover:scale-110 transition-transform">
                        <Zap className="h-4 w-4 text-[#01ADFB]" />
                      </div>
                      <div>
                        <h4 className="font-medium text-zinc-900 dark:text-zinc-100">{item.nombre}</h4>
                        <span className={cn(
                          "inline-block mt-2 text-[9px] font-medium uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border",
                          item.activo 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" 
                            : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700"
                        )}>
                          {item.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleToggleServiceStatus(item)}
                        disabled={actionLoading === item.id}
                        className={cn(
                          "h-8 w-8 rounded-md shadow-sm border border-transparent transition-all",
                          item.activo 
                            ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-200 dark:hover:border-emerald-500/20" 
                            : "text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                        )}
                      >
                        {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleOpenServiceModal(item)} 
                        disabled={actionLoading === item.id}
                        className="h-8 w-8 rounded-md hover:bg-white dark:hover:bg-zinc-800 hover:text-[#01ADFB] shadow-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteService(item)}
                        disabled={actionLoading === item.id}
                        className="h-8 w-8 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 shadow-sm border border-transparent hover:border-red-100 dark:hover:border-red-500/20 transition-all"
                      >
                        {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
                {servicios.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <div className="h-20 w-20 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mb-6">
                      <Zap className="h-8 w-8 opacity-10" />
                    </div>
                    <p className="font-medium uppercase tracking-[0.12em] text-[10px]">No hay servicios configurados para esta empresa</p>
                    <Button variant="link" onClick={() => handleOpenServiceModal()} className="text-[#01ADFB] font-bold text-xs mt-2 uppercase tracking-widest">Crear el primero</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
  
          {isServiceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <Card className="w-full max-w-lg animate-in fade-in zoom-in duration-200 border-none shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-[13px] font-medium">
                      {editingService ? 'Editar' : 'Agregar'} Servicio
                    </CardTitle>
                    <CardDescription className="mt-1 text-[11px] font-medium">Completa los campos para guardar los cambios</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleCloseServiceModal} className="h-8 w-8 rounded-full">
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <form onSubmit={handleSubmitService}>
                  <CardContent className="space-y-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded-lg p-5 border border-zinc-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center gap-2 text-[#01ADFB] dark:text-azul-400">
                        <Zap className="h-4 w-4" />
                        <span className="text-[10px] font-medium uppercase tracking-[0.15em]">Servicios Operativos</span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                        Define los nombres de los servicios que esta empresa ofrece. Estos aparecerán al crear nuevas órdenes de servicio.
                      </p>
                    </div>
  
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Nombre del Servicio</Label>
                      <Input name="nombre" defaultValue={editingService?.nombre} required placeholder="Ej: Control de Plagas, Desinfección" className="h-12 rounded-md dark:bg-zinc-900 dark:border-zinc-800" />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                    <Button type="button" variant="ghost" onClick={handleCloseServiceModal} className="font-bold text-xs uppercase tracking-widest">Cancelar</Button>
                    <Button type="submit" className="bg-[#01ADFB] hover:bg-blue-700 text-white dark:text-zinc-300 font-bold rounded-md gap-2 h-8 px-3">
                      <Save className="h-4 w-4" /> GUARDAR CAMBIOS
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          )}
        </Card>
      );
    }
  
    return (
      <Card className="border border-border bg-card shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4 border-b border-border bg-card">
  
          <div>
            <CardTitle className="text-[13px] uppercase tracking-[0.12em] font-medium tracking-tight dark:text-zinc-100">
              Empresas
            </CardTitle>
            <CardDescription className="mt-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              Gestiona las empresas del negocio
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {limitReached && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-md text-amber-700 dark:text-amber-400 text-[10px] font-medium uppercase tracking-widest shadow-sm">
                <AlertTriangle className="h-3.5 w-3.5" />
                LÍMITE ({enterprises.length}/{maxEmpresas})
              </div>
            )}
            <Button 
              onClick={() => handleOpenModal()} 
              disabled={limitReached}
              className="bg-[#01ADFB] hover:bg-blue-700 text-white dark:text-zinc-300 font-medium text-[10px] rounded-md gap-2 h-11 px-3 shadow-lg shadow-[#01ADFB]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
              <Plus className="h-4 w-4" /> AGREGAR NUEVA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-card">        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 border-4 border-azul-1/20 border-t-azul-1 rounded-full animate-spin" />
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 animate-pulse">Cargando empresas...</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {enterprises.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 bg-card rounded-lg border border-border hover:border-[#01ADFB]/30 transition-all group">
                <div className="flex gap-4 items-center">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center border border-border shadow-sm group-hover:scale-110 transition-transform">
                    <Building className="h-4 w-4 text-[#01ADFB]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100">{item.nombre}</h4>
                    <span className={cn(
                      "inline-block mt-2 text-[9px] font-medium uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border",
                      item.activo
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                        : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700"
                    )}>
                      {item.activo ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setSelectedEnterprise(item)}
                                    title="Gestionar Servicios"
                                    className="h-8 w-8 rounded-md hover:bg-white dark:hover:bg-zinc-800 hover:text-[#01ADFB] shadow-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all"
                                  >
                                    <Settings2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleToggleStatus(item)}
                                    disabled={actionLoading === item.id}
                                    title={item.activo ? "Desactivar" : "Activar"}
                                    className={cn(
                                      "h-8 w-8 rounded-md shadow-sm border border-transparent transition-all",
                                      item.activo 
                                        ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-200 dark:hover:border-emerald-500/20" 
                                        : "text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                                    )}
                                  >
                                    {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleOpenModal(item)} 
                                    disabled={actionLoading === item.id}
                                    className="h-8 w-8 rounded-md hover:bg-white dark:hover:bg-zinc-800 hover:text-[#01ADFB] shadow-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleDelete(item)}
                                    disabled={actionLoading === item.id}
                                    className="h-8 w-8 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 shadow-sm border border-transparent hover:border-red-100 dark:hover:border-red-500/20 transition-all"
                                  >
                                    {actionLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </div>              </div>
            ))}
            {!loading && enterprises.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                <div className="h-20 w-20 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mb-6">
                  <Building className="h-8 w-8 opacity-10" />
                </div>
                <p className="font-medium uppercase tracking-[0.12em] text-[10px]">No hay empresas configuradas</p>
                <Button variant="link" onClick={() => handleOpenModal()} className="text-[#01ADFB] font-bold text-xs mt-2 uppercase tracking-widest">Crear la primera</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg animate-in fade-in zoom-in duration-200 border-none shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-[13px] font-medium">
                  {editingItem ? 'Editar' : 'Agregar'} Empresa
                </CardTitle>
                <CardDescription className="mt-1 text-[11px] font-medium">Completa los campos para guardar los cambios</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseModal} className="h-8 w-8 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded-lg p-5 border border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-[#01ADFB]">
                    <Building className="h-4 w-4" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.15em]">Estructura Organizativa</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                    Las empresas permiten separar la facturación, los técnicos asignados y los reportes de servicio. Ideal para grupos empresariales o franquicias.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Nombre de la Empresa</Label>
                  <Input name="nombre" defaultValue={editingItem?.nombre} required placeholder="Ej: Mi Empresa SAS" className="h-12 rounded-md dark:bg-zinc-900 dark:border-zinc-800" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                <Button type="button" variant="ghost" onClick={handleCloseModal} className="font-bold text-xs uppercase tracking-widest">Cancelar</Button>
                <Button type="submit" className="bg-[#01ADFB] hover:bg-blue-700 text-white dark:text-zinc-300 font-bold rounded-md gap-2 h-8 px-3">
                  <Save className="h-4 w-4" /> GUARDAR CAMBIOS
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}

