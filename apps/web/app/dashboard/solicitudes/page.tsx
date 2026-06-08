"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard";
import { formatBogotaDate } from "@/utils/date-utils";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { Users, Check, X, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { tenantsClient } from "@/lib/api/tenants-client";

interface PendingMembership {
  id: string;
  user: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  };
  createdAt: string;
}

export default function SolicitudesPage() {
  const [requests, setRequests] = useState<PendingMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const parsedUser = JSON.parse(userData);
      const tenantId = parsedUser.tenantId;
      if (!tenantId) return;
      
      const data = await tenantsClient.getPendingMemberships(tenantId);
      setRequests(data as unknown as PendingMembership[]);

    } catch (_error) {
      toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await tenantsClient.approveMembership(id);
      toast.success("Usuario aprobado correctamente");
      setRequests(requests.filter(r => r.id !== id));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al procesar aprobación";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await tenantsClient.rejectMembership(id);
      toast.success("Solicitud rechazada");
      setRequests(requests.filter(r => r.id !== id));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al procesar rechazo";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-foreground lg:text-5xl">
            Solicitudes de <span className="text-[#01ADFB]">Unión</span>
          </h1>
          <p className="text-lg font-medium text-muted-foreground">
            Gestiona quién puede entrar a tu organización.
          </p>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#01ADFB]" />
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-[2.5rem] bg-card/40 backdrop-blur-md border border-border p-20 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-muted">
              <Users className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h2 className="mt-8 text-2xl font-black tracking-tight text-foreground">Sin solicitudes pendientes</h2>
            <p className="mt-2 text-muted-foreground font-medium">No hay usuarios esperando aprobación en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {requests.map((request) => (
              <Card key={request.id} className="group overflow-hidden border border-border bg-card/60 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] rounded-[2rem]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#01ADFB]/10 text-[#01ADFB]">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatBogotaDate(request.createdAt)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <CardTitle className="text-xl font-black tracking-tight text-foreground">{request.user.nombre} {request.user.apellido}</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium truncate mb-8">{request.user.email}</p>

                  <div className="flex gap-3">
                    <Button 
                      onClick={() => handleApprove(request.id)}
                      disabled={processingId === request.id}
                      className="flex-1 bg-[#01ADFB] hover:bg-[#01ADFB]/90 text-white rounded-xl h-12 gap-2 shadow-lg shadow-[#01ADFB]/20 transition-all active:scale-95"
                    >
                      {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Aprobar
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                      className="flex-1 border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-xl h-12 gap-2 transition-all active:scale-95"
                    >
                      <X className="h-4 w-4" />
                      Rechazar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
