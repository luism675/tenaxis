"use client";

import React, { useState, useEffect } from "react";
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent, Select } from "@/components/ui";
import { Building2, Plus, Users, Mail, Loader2, X, ShieldCheck, CreditCard, UserPlus, Eye, Pencil } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { tenantsClient } from "@/lib/api/tenants-client";

export interface TenantDetail extends Tenant {
  memberships: Array<{
    user: {
      nombre: string;
      apellido: string;
      email: string;
    };
    role: string;
  }>;
  empresas: Array<{
    id: string;
    nombre: string;
  }>;
  subscription?: {
    plan: {
      nombre: string;
    };
    endDate: string;
  } | null;
}

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  correo?: string;
  nit?: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    memberships: number;
    empresas: number;
  };
}

export interface Plan {
  id: string;
  nombre: string;
  price: number;
}

interface TenantListProps {
  initialTenants: Tenant[];
  availablePlans: Plan[];
}

export function TenantList({ initialTenants, availablePlans }: TenantListProps) {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTenantDetail, setSelectedTenantDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setIsViewModalOpen(false);
        setSlugTouched(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleViewTenant = async (tenantId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await tenantsClient.getById(tenantId);
      setSelectedTenantDetail(detail as unknown as TenantDetail);

      setIsViewModalOpen(true);
    } catch (_error) {
      toast.error("No se pudo cargar la información del sistema");
    } finally {
      setLoadingDetail(false);
    }
  };

  const [formData, setFormData] = useState({
    nombre: "",
    slug: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerNombre: "",
    ownerApellido: "",
    nit: "",
    correo: "",
    planId: availablePlans[0]?.id || "",
    durationDays: 30,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newTenant = await tenantsClient.createTenant(formData);
      setTenants([newTenant as unknown as Tenant, ...tenants]);
      setIsModalOpen(false);
      setSlugTouched(false);
      setFormData({
        nombre: "",
        slug: "",
        ownerEmail: "",
        ownerPassword: "",
        ownerNombre: "",
        ownerApellido: "",
        nit: "",
        correo: "",
        planId: availablePlans[0]?.id || "",
        durationDays: 30
      });
      toast.success("Tenant creado exitosamente");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear tenant");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "slug") setSlugTouched(true);
    setFormData((prev) => {
      const newFormData = { ...prev, [name]: name === "durationDays" ? parseInt(value) : value };
      if (name === "nombre" && !slugTouched) {
        newFormData.slug = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      }
      return newFormData;
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSlugTouched(false);
  };

  return (
    <div className="space-y-8 bg-background">
      <div className="flex justify-end">
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 h-12 px-6 rounded-2xl bg-[#01ADFB] text-white hover:bg-blue-700 transition-all border-none shadow-none">
          <Plus className="h-5 w-5" />
          <span className="font-black uppercase tracking-widest text-xs">Nuevo Tenant</span>
        </Button>
      </div>

      {tenants.length === 0 ? (
        <div className="rounded-[3rem] border-4 border-border p-20 text-center bg-card shadow-xl">
          <div className="flex flex-col items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[#01ADFB] text-white shadow-2xl">
              <Building2 className="h-10 w-10" />
            </div>
            <h2 className="mt-8 text-2xl font-black tracking-tighter text-foreground">No hay tenants registrados</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground font-medium italic">Comienza creando tu primer tenant para administrar organizaciones.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="group overflow-hidden border-none shadow-xl bg-card transition-all hover:scale-[1.02] rounded-[3rem] relative">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-10 px-10 relative z-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#01ADFB] text-white shadow-lg"><Building2 className="h-8 w-8" /></div>
                <span className={cn("rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-sm", tenant.isActive ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>{tenant.isActive ? "Activo" : "Inactivo"}</span>
              </CardHeader>
              <CardContent className="pt-6 px-10 pb-10 relative z-10">
                <CardTitle className="text-3xl font-black tracking-tighter mb-1 leading-none text-foreground">{tenant.nombre}</CardTitle>
                <div className="inline-flex items-center gap-2 mt-2 mb-8"><div className="h-1.5 w-1.5 rounded-full bg-[#01ADFB]" /><p className="text-[10px] font-black text-[#01ADFB] uppercase tracking-[0.3em]">ID: {tenant.slug}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 p-5 rounded-2xl bg-muted/50 border border-border"><Users className="h-5 w-5 text-[#01ADFB]" /><span className="text-2xl font-black text-foreground tabular-nums leading-none mt-2">{tenant._count?.memberships || 0}</span><span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Miembros</span></div>
                  <div className="flex flex-col gap-1 p-5 rounded-2xl bg-muted/50 border border-border"><Building2 className="h-5 w-5 text-[#01ADFB]" /><span className="text-2xl font-black text-foreground tabular-nums leading-none mt-2">{tenant._count?.empresas || 0}</span><span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sedes</span></div>
                </div>
                {tenant.correo && <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-bold text-muted-foreground truncate">{tenant.correo}</span></div>}
                <div className="mt-10 flex items-center gap-4 pt-6 border-t border-border">
                  <button onClick={() => handleViewTenant(tenant.id)} disabled={loadingDetail} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-[#01ADFB] transition-colors disabled:opacity-50">{loadingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Ver</button>
                  <div className="h-4 w-[1px] bg-border" />
                  <Button className="flex-1 h-11 rounded-xl bg-foreground text-background hover:opacity-90 transition-all shadow-md"><Pencil className="h-4 w-4 mr-2" /><span className="text-xs font-black uppercase tracking-widest">Gestionar</span></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isViewModalOpen && selectedTenantDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-md animate-in fade-in duration-300" onClick={(e) => { if (e.target === e.currentTarget) setIsViewModalOpen(false); }}>
          <div className="w-full max-w-4xl overflow-hidden rounded-[3rem] bg-background shadow-2xl animate-in zoom-in-95 duration-300 border-none">
            <div className="relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="sticky top-0 z-10 flex items-center justify-between bg-background/90 p-8 pb-4 backdrop-blur-md border-b border-border">
                <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#01ADFB] text-white shadow-lg"><Building2 className="h-6 w-6" /></div><div><h2 className="text-3xl font-black tracking-tighter text-foreground">{selectedTenantDetail.nombre}</h2><p className="text-xs font-bold text-[#01ADFB] uppercase tracking-widest">ID: {selectedTenantDetail.slug}</p></div></div>
                <button onClick={() => setIsViewModalOpen(false)} className="rounded-full p-3 text-muted-foreground hover:bg-muted transition-all hover:rotate-90"><X className="h-6 w-6" /></button>
              </div>
              <div className="p-10 space-y-12 bg-background">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-1 p-6 rounded-3xl bg-muted/50 border border-border"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">NIT / Identificación</p><p className="text-lg font-black text-foreground">{selectedTenantDetail.nit || "No registrado"}</p></div>
                  <div className="space-y-1 p-6 rounded-3xl bg-muted/50 border border-border"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Corporativo</p><p className="text-lg font-black text-foreground truncate">{selectedTenantDetail.correo || "No registrado"}</p></div>
                  <div className="space-y-1 p-6 rounded-3xl bg-muted/50 border border-border"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Suscripción Activa</p><p className="text-lg font-black text-[#01ADFB]">{selectedTenantDetail.subscription?.plan.nombre || "Sin plan"}</p></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4"><Users className="h-5 w-5 text-[#01ADFB]" /><h3 className="text-sm font-black uppercase tracking-widest text-foreground">Miembros de la Organización</h3><span className="ml-auto text-xs font-black bg-muted px-2 py-1 rounded-lg text-muted-foreground">{selectedTenantDetail.memberships.length}</span></div>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">{selectedTenantDetail.memberships.map((membership, _idx) => (<div key={_idx} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border shadow-sm"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center text-background font-black text-xs">{membership.user.nombre[0]}{membership.user.apellido[0]}</div><div><p className="text-sm font-black text-foreground">{membership.user.nombre} {membership.user.apellido}</p><p className="text-[10px] font-bold text-muted-foreground">{membership.user.email}</p></div></div><span className="text-[9px] font-black uppercase tracking-widest bg-[#01ADFB]/10 text-[#01ADFB] px-3 py-1 rounded-full">{membership.role}</span></div>))}</div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4"><Building2 className="h-5 w-5 text-[#01ADFB]" /><h3 className="text-sm font-black uppercase tracking-widest text-foreground">Sedes / Empresas</h3><span className="ml-auto text-xs font-black bg-muted px-2 py-1 rounded-lg text-muted-foreground">{selectedTenantDetail.empresas.length}</span></div>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">{selectedTenantDetail.empresas.map((empresa, idx) => (<div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border shadow-sm"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-[#01ADFB]/10 flex items-center justify-center text-[#01ADFB]"><Building2 className="h-5 w-5" /></div><p className="text-sm font-black text-foreground">{empresa.nombre}</p></div><button className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-[#01ADFB] transition-colors">Ver Sede</button></div>))}</div>
                  </div>
                </div>
                <div className="pt-8 border-t border-border flex justify-end"><Button onClick={() => setIsViewModalOpen(false)} className="h-12 px-8 rounded-xl bg-[#01ADFB] text-white hover:bg-[#01ADFB]/90 transition-all shadow-lg shadow-[#01ADFB]/20">Cerrar Vista</Button></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-md animate-in fade-in duration-300" onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-[3rem] bg-background shadow-[0_0_100px_-12px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-300 border border-border">
            <div className="relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="sticky top-0 z-10 flex items-center justify-between bg-background/80 p-8 pb-4 backdrop-blur-md">
                <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-xl"><ShieldCheck className="h-6 w-6" /></div><div><h2 className="text-3xl font-black tracking-tighter text-foreground">Configurar Tenant</h2><p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Paso único de creación</p></div></div>
                <button onClick={handleCloseModal} className="rounded-full p-3 text-muted-foreground hover:bg-muted transition-all hover:rotate-90"><X className="h-6 w-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-border pb-2"><Building2 className="h-4 w-4 text-[#01ADFB]" /><h3 className="text-sm font-black uppercase tracking-widest text-foreground">Organización</h3></div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="nombre" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Nombre Comercial</Label><Input id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} required placeholder="Ej: Tenaxis Corp" className="rounded-2xl h-12 border-border focus:border-foreground bg-background text-foreground" /></div>
                    <div className="space-y-2"><Label htmlFor="slug" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Slug / URL</Label><Input id="slug" name="slug" value={formData.slug} onChange={handleChange} required placeholder="tenaxis-corp" className="rounded-2xl h-12 border-border font-mono text-xs bg-muted/50 text-foreground" /></div>
                    <div className="space-y-2"><Label htmlFor="nit" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">NIT / Tax ID</Label><Input id="nit" name="nit" value={formData.nit} onChange={handleChange} placeholder="900.123.456-1" className="rounded-2xl h-12 border-border focus:border-foreground bg-background text-foreground" /></div>
                    <div className="space-y-2"><Label htmlFor="correo" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Email Corporativo</Label><Input id="correo" name="correo" type="email" value={formData.correo} onChange={handleChange} placeholder="hola@empresa.com" className="rounded-2xl h-12 border-border focus:border-foreground bg-background text-foreground" /></div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-border pb-2"><UserPlus className="h-4 w-4 text-primary" /><h3 className="text-sm font-black uppercase tracking-widest text-foreground">Administrador Principal</h3></div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="ownerNombre" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Nombre</Label><Input id="ownerNombre" name="ownerNombre" value={formData.ownerNombre} onChange={handleChange} required placeholder="Juan" className="rounded-2xl h-12 border-border bg-background text-foreground" /></div>
                    <div className="space-y-2"><Label htmlFor="ownerApellido" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Apellido</Label><Input id="ownerApellido" name="ownerApellido" value={formData.ownerApellido} onChange={handleChange} required placeholder="Pérez" className="rounded-2xl h-12 border-border bg-background text-foreground" /></div>
                    <div className="space-y-2"><Label htmlFor="ownerEmail" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Email de Acceso</Label><Input id="ownerEmail" name="ownerEmail" type="email" value={formData.ownerEmail} onChange={handleChange} required placeholder="admin@empresa.com" className="rounded-2xl h-12 border-border bg-background text-foreground" /></div>
                    <div className="space-y-2"><Label htmlFor="ownerPassword" id="ownerPassword-label" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Contraseña Temporal</Label><Input id="ownerPassword" name="ownerPassword" type="password" value={formData.ownerPassword} onChange={handleChange} placeholder="••••••••" className="rounded-2xl h-12 border-border bg-background text-foreground" /></div>
                  </div>
                </div>
                <div className="space-y-6 p-6 rounded-[2rem] bg-muted/50 border border-border">
                  <div className="flex items-center gap-3 border-b border-border pb-2"><CreditCard className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-black uppercase tracking-widest text-foreground">Plan de Servicio</h3></div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="planId" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Seleccionar Plan</Label><Select id="planId" name="planId" value={formData.planId} onChange={handleChange} required className="bg-background text-foreground border-border">{availablePlans.map((plan) => (<option key={plan.id} value={plan.id} className="bg-background text-foreground">{plan.nombre} — ${plan.price}</option>))}</Select></div>
                    <div className="space-y-2"><Label htmlFor="durationDays" className="ml-1 text-[11px] font-black uppercase text-muted-foreground">Periodo Inicial</Label><Select id="durationDays" name="durationDays" value={formData.durationDays} onChange={handleChange} required className="bg-background text-foreground border-border"><option value="15" className="bg-background text-foreground">Prueba Gratuita (15 días)</option><option value="30" className="bg-background text-foreground">Mensual (30 días)</option><option value="90" className="bg-background text-foreground">Trimestral (90 días)</option><option value="365" className="bg-background text-foreground">Anual (365 días)</option></Select></div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4 sticky bottom-0 bg-background py-4 border-t border-border">
                  <Button type="button" variant="outline" onClick={handleCloseModal} className="flex-1 h-14 rounded-2xl border-2 border-border font-bold uppercase tracking-widest text-xs bg-background text-muted-foreground hover:bg-muted">Cancelar</Button>
                  <Button type="submit" disabled={loading} className="flex-1 h-14 rounded-2xl bg-[#01ADFB] text-white hover:bg-blue-700 shadow-2xl transition-all">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="font-black uppercase tracking-widest">Crear Tenant</span>}</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
