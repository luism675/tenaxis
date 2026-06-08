"use client";

import React, { useState } from "react";
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Building2, ArrowRight, Loader2, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { tenantsClient } from "@/lib/api/tenants-client";

export function JoinOrganization() {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  React.useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData && userData !== "undefined") {
      try {
        const user = JSON.parse(userData);
        setIsPending(!!user.hasPendingRequest);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await tenantsClient.join(slug);

      toast.success("Solicitud enviada exitosamente. Espera a que un administrador te apruebe.");
      setSlug("");
      setIsPending(true);
      
      // Update local user data
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        user.hasPendingRequest = true;
        localStorage.setItem("user", JSON.stringify(user));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl shadow-zinc-200/50 dark:shadow-none bg-white dark:bg-zinc-900 overflow-hidden rounded-[2.5rem]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(39,39,42,0.05)_0%,transparent 50%)]" />
          
          <CardHeader className="relative pb-2 text-center pt-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-amber-50 text-amber-600 shadow-xl dark:bg-amber-500 dark:text-white">
              <Clock className="h-10 w-10" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tighter dark:text-amber-400">Solicitud Pendiente</CardTitle>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium italic">Tu solicitud de unión está siendo revisada.</p>
          </CardHeader>

          <CardContent className="relative p-8 sm:p-12 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Un administrador del conglomerado debe aprobar tu ingreso. 
              Recibirás acceso completo al dashboard una vez que seas aceptado.
            </p>
            
            <div className="mt-10 pt-8 border-t border-zinc-50 dark:border-zinc-800">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-300">
                ¿Te equivocaste de slug?
              </p>
              <button 
                onClick={() => setIsPending(false)}
                className="mt-4 text-xs font-black text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
              >
                Intentar con otro código
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md border-none shadow-2xl shadow-zinc-200/50 dark:shadow-none bg-white dark:bg-zinc-900 overflow-hidden rounded-[2.5rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(39,39,42,0.05)_0%,transparent 50%)]" />
        
        <CardHeader className="relative pb-2 text-center pt-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-indigo-600 text-white shadow-xl dark:bg-indigo-500">
            <Building2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter dark:text-indigo-400">Bienvenido a Tenaxis</CardTitle>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium italic">Parece que aún no perteneces a ninguna organización.</p>
        </CardHeader>

        <CardContent className="relative p-8 sm:p-12">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="slug" className="ml-2 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Slug de la Organización
              </Label>
              <div className="relative group">
                <Input
                  id="slug"
                  placeholder="ej: mi-empresa-abc"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  className="h-14 rounded-2xl border-2 border-zinc-100 bg-zinc-50/50 pl-6 focus:border-indigo-500 transition-all dark:bg-zinc-800/50 dark:border-zinc-800 dark:focus:border-indigo-400 dark:text-white"
                />
              </div>
              <p className="ml-2 text-[10px] text-zinc-400 dark:text-zinc-300 font-bold uppercase tracking-wider">
                Pídele el slug a tu administrador para unirte.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !slug}
              style={{ color: 'white' }}
              className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl transition-all disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'white' }} />
              ) : (
                <div className="flex items-center gap-3" style={{ color: 'white' }}>
                  <span className="font-black uppercase tracking-widest" style={{ color: 'white' }}>Solicitar Unión</span>
                  <ArrowRight className="h-5 w-5" style={{ color: 'white' }} />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-12 pt-8 border-t border-zinc-50 dark:border-zinc-800 text-center">
            <div className="flex items-center justify-center gap-2 text-zinc-400 dark:text-zinc-300">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-bold uppercase tracking-widest">¿Eres dueño de negocio?</p>
            </div>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Contacta con soporte para crear tu propio conglomerado.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
