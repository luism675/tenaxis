"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useUserRole } from "@/hooks/use-user-role";
import { ArrowLeft, Save, Loader2, UserPlus, ShieldAlert } from "lucide-react";
import { enterpriseClient, type Enterprise } from "@/lib/api/enterprise-client";
import { tenantsClient } from "@/lib/api/tenants-client";

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const { tenantId, role: currentRole, checkPermission, isLoading: isLoadingRole } = useUserRole();
  const canCreateTeam = checkPermission("TEAM_CREATE");
  const [loading, setLoading] = useState(false);
  const submitInFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [enterpriseLoadError, setEnterpriseLoadError] = useState<string | null>(null);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loadingEnterprises, setLoadingEnterprises] = useState(false);
  const allowedRoleOptions = useMemo(
    () => currentRole === "COORDINADOR"
      ? [
          { value: "ASESOR", label: "Asesor" },
          { value: "OPERADOR", label: "Operador" },
        ]
      : [
          { value: "ADMIN", label: "Administrador" },
          { value: "COORDINADOR", label: "Coordinador" },
          { value: "ASESOR", label: "Asesor" },
          { value: "OPERADOR", label: "Operador" },
        ],
    [currentRole],
  );

  const [formData, setFormData] = useState({
    email: "",
    nombre: "",
    apellido: "",
    telefono: "",
    password: "",
    confirmPassword: "",
    role: "ASESOR", // Default role
    empresaId: "",
  });

  // Check Permissions
  useEffect(() => {
    if (!isLoadingRole && !canCreateTeam) {
      router.replace("/dashboard/equipo-trabajo");
    }
  }, [canCreateTeam, isLoadingRole, router]);

  useEffect(() => {
    if (!allowedRoleOptions.some((option) => option.value === formData.role)) {
      setFormData((prev) => ({ ...prev, role: allowedRoleOptions[0]?.value || "ASESOR" }));
    }
  }, [allowedRoleOptions, formData.role]);

  useEffect(() => {
    if (isLoadingRole || !tenantId || !canCreateTeam) {
      return;
    }

    let cancelled = false;

    const loadEnterprises = async () => {
      try {
        setLoadingEnterprises(true);
        setEnterpriseLoadError(null);
        const enterpriseRows = await enterpriseClient.getAll();

        if (cancelled) {
          return;
        }

        setEnterprises(enterpriseRows);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setEnterprises([]);
        setEnterpriseLoadError(
          err instanceof Error ? err.message : "No se pudo cargar la lista de empresas",
        );
      } finally {
        if (!cancelled) {
          setLoadingEnterprises(false);
        }
      }
    };

    loadEnterprises();

    return () => {
      cancelled = true;
    };
  }, [canCreateTeam, isLoadingRole, tenantId]);

  useEffect(() => {
    if (formData.role !== "OPERADOR" || formData.empresaId || enterprises.length !== 1) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      empresaId: prev.empresaId || enterprises[0]?.id || "",
    }));
  }, [enterprises, formData.empresaId, formData.role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "role" && value !== "OPERADOR" ? { empresaId: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current || loading) {
      return;
    }

    if (!tenantId) {
      setError("No se ha identificado el conglomerado actual.");
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedPassword = formData.password.trim();
    const normalizedConfirmPassword = formData.confirmPassword.trim();

    if (!normalizedEmail) {
      setError("Ingresá un correo válido.");
      return;
    }

    if (normalizedPassword && normalizedPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (normalizedPassword && normalizedPassword !== normalizedConfirmPassword) {
      setError("La confirmación de contraseña no coincide.");
      return;
    }

    if (formData.role === "OPERADOR" && !formData.empresaId) {
      setError("Debes seleccionar la empresa a la que pertenece el operador.");
      return;
    }

    try {
      submitInFlightRef.current = true;
      setLoading(true);
      setError(null);

      await tenantsClient.inviteMember(tenantId, {
        email: normalizedEmail,
        role: formData.role,
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        telefono: formData.telefono.trim() || undefined,
        password: normalizedPassword || undefined,
        empresaIds:
          formData.role === "OPERADOR" && formData.empresaId
            ? [formData.empresaId]
            : undefined,
      });

      // Volver a la lista de usuarios
      router.push("/dashboard/equipo-trabajo");
      router.refresh(); // Forzar actualización de la página
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error inesperado";
      setError(errorMessage);
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  if (isLoadingRole) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#01ADFB]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canCreateTeam) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
          <ShieldAlert className="h-16 w-16 text-red-500" />
          <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Acceso Denegado</h2>
          <p className="text-sm text-muted-foreground">No tienes permisos para crear usuarios.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-accent/20 transition-all hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-400 hover:text-azul-1 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al equipo
            </button>
            <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-azul-1" />
              Nuevo Usuario
            </h1>
            <p className="text-zinc-500 font-medium">
              Agrega un nuevo miembro a tu equipo de trabajo.
            </p>
          </div>
        </div>

        {/* Formulario */}
        <Card className="border-none shadow-2xl shadow-zinc-200/50 dark:shadow-none bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">Datos del Usuario</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="nombre" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                    Nombre
                  </Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Ej. Juan"
                    className="h-12"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apellido" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                    Apellido
                  </Label>
                  <Input
                    id="apellido"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                    placeholder="Ej. Pérez"
                    className="h-12"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                    Correo Electrónico
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="juan.perez@ejemplo.com"
                    className="h-12"
                    disabled={loading}
                    required
                  />
                  <p className="text-[10px] text-zinc-500 px-1">
                    Si el correo no existe, se creará el usuario y se sumará al equipo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                    Teléfono (Opcional)
                  </Label>
                  <Input
                    id="telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="+57 300 123 4567"
                    className="h-12"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                    Contraseña Inicial
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Mínimo 6 caracteres"
                    className="h-12"
                    disabled={loading}
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <p className="text-[10px] text-zinc-500 px-1">
                    Opcional. Si lo dejás vacío, se usará la contraseña inicial del equipo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                    Confirmar Contraseña
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repetí la contraseña"
                    className="h-12"
                    disabled={loading}
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <p className="text-[10px] text-zinc-500 px-1">
                    Si el correo ya está registrado, se conserva su contraseña actual.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                  Rol en la Empresa
                </Label>
                <Select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={(e) => handleChange(e as React.ChangeEvent<HTMLInputElement | HTMLSelectElement>)}
                  className="h-12"
                  disabled={loading}
                  required
                >
                  {allowedRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="text-[10px] text-zinc-500 px-1">
                  El rol determina los permisos del usuario dentro de la plataforma.
                </p>
              </div>

              {formData.role === "OPERADOR" ? (
                <div className="space-y-2">
                  <Label htmlFor="empresaId" className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400 px-1">
                    Empresa del Operador
                  </Label>
                  <Select
                    id="empresaId"
                    name="empresaId"
                    value={formData.empresaId}
                    onChange={(e) => handleChange(e as React.ChangeEvent<HTMLInputElement | HTMLSelectElement>)}
                    className="h-12"
                    disabled={loading || loadingEnterprises || enterprises.length === 0}
                    required
                  >
                    <option value="">
                      {loadingEnterprises
                        ? "Cargando empresas..."
                        : enterprises.length > 0
                          ? "Seleccioná una empresa"
                          : "No hay empresas disponibles"}
                    </option>
                    {enterprises.map((enterprise) => (
                      <option key={enterprise.id} value={enterprise.id}>
                        {enterprise.nombre}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[10px] text-zinc-500 px-1">
                    Este selector crea también la vinculación operativa del usuario con la empresa elegida.
                  </p>
                  {enterpriseLoadError ? (
                    <p className="text-[10px] text-red-500 px-1">
                      {enterpriseLoadError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading || (formData.role === "OPERADOR" && loadingEnterprises)}
                  className="flex h-12 w-full md:w-auto items-center justify-center gap-2 rounded-2xl bg-azul-1 dark:bg-azul-1 px-8 text-sm font-black uppercase tracking-widest text-white dark:text-zinc-300 shadow-lg shadow-azul-1/20 transition-all hover:bg-blue-700 dark:hover:bg-blue-700/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Crear Usuario
                    </>
                  )}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
