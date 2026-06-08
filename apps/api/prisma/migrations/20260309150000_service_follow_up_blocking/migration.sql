ALTER TYPE "public"."TipoPermiso" ADD VALUE IF NOT EXISTS 'DESBLOQUEO_ASIGNACION_SERVICIOS';

ALTER TABLE "public"."servicios"
ADD COLUMN "requiereSeguimiento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "primerSeguimientoDias" INTEGER,
ADD COLUMN "requiereSeguimientoTresMeses" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "public"."ordenes_servicio_seguimientos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "ordenServicioId" UUID NOT NULL,
    "createdByMembershipId" UUID NOT NULL,
    "completedByMembershipId" UUID,
    "followUpType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "channel" TEXT,
    "outcome" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_servicio_seguimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordenes_servicio_seguimientos_tenantId_idx" ON "public"."ordenes_servicio_seguimientos"("tenantId");
CREATE INDEX "ordenes_servicio_seguimientos_empresaId_idx" ON "public"."ordenes_servicio_seguimientos"("empresaId");
CREATE INDEX "ordenes_servicio_seguimientos_createdByMembershipId_idx" ON "public"."ordenes_servicio_seguimientos"("createdByMembershipId");
CREATE INDEX "ordenes_servicio_seguimientos_ordenServicioId_idx" ON "public"."ordenes_servicio_seguimientos"("ordenServicioId");
CREATE INDEX "ordenes_servicio_seguimientos_status_idx" ON "public"."ordenes_servicio_seguimientos"("status");
CREATE INDEX "ordenes_servicio_seguimientos_dueAt_idx" ON "public"."ordenes_servicio_seguimientos"("dueAt");

ALTER TABLE "public"."ordenes_servicio_seguimientos"
ADD CONSTRAINT "ordenes_servicio_seguimientos_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ordenes_servicio_seguimientos"
ADD CONSTRAINT "ordenes_servicio_seguimientos_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ordenes_servicio_seguimientos"
ADD CONSTRAINT "ordenes_servicio_seguimientos_ordenServicioId_fkey"
FOREIGN KEY ("ordenServicioId") REFERENCES "public"."ordenes_servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ordenes_servicio_seguimientos"
ADD CONSTRAINT "ordenes_servicio_seguimientos_createdByMembershipId_fkey"
FOREIGN KEY ("createdByMembershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ordenes_servicio_seguimientos"
ADD CONSTRAINT "ordenes_servicio_seguimientos_completedByMembershipId_fkey"
FOREIGN KEY ("completedByMembershipId") REFERENCES "public"."tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
