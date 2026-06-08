-- CreateEnum
CREATE TYPE "EquipoTrabajoTareaEstado" AS ENUM ('PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA', 'COMPLETADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "equipo_trabajo_tareas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "observaciones" TEXT,
    "estado" "EquipoTrabajoTareaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_limite" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "responsable_membership_id" UUID NOT NULL,
    "asignada_por_membership_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "equipo_trabajo_tareas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipo_trabajo_tareas_tenant_id_idx" ON "equipo_trabajo_tareas"("tenant_id");

-- CreateIndex
CREATE INDEX "equipo_trabajo_tareas_empresa_id_idx" ON "equipo_trabajo_tareas"("empresa_id");

-- CreateIndex
CREATE INDEX "equipo_trabajo_tareas_tenant_id_empresa_id_idx" ON "equipo_trabajo_tareas"("tenant_id", "empresa_id");

-- CreateIndex
CREATE INDEX "equipo_trabajo_tareas_tenant_empresa_estado_idx" ON "equipo_trabajo_tareas"("tenant_id", "empresa_id", "estado");

-- CreateIndex
CREATE INDEX "equipo_trabajo_tareas_responsable_idx" ON "equipo_trabajo_tareas"("responsable_membership_id");

-- CreateIndex
CREATE INDEX "equipo_trabajo_tareas_asignada_por_idx" ON "equipo_trabajo_tareas"("asignada_por_membership_id");

-- CreateIndex
CREATE INDEX "equipo_trabajo_tareas_fecha_limite_idx" ON "equipo_trabajo_tareas"("fecha_limite");

-- AddForeignKey
ALTER TABLE "equipo_trabajo_tareas" ADD CONSTRAINT "equipo_trabajo_tareas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo_trabajo_tareas" ADD CONSTRAINT "equipo_trabajo_tareas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo_trabajo_tareas" ADD CONSTRAINT "equipo_trabajo_tareas_responsable_fkey" FOREIGN KEY ("responsable_membership_id") REFERENCES "tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo_trabajo_tareas" ADD CONSTRAINT "equipo_trabajo_tareas_asignada_por_fkey" FOREIGN KEY ("asignada_por_membership_id") REFERENCES "tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
