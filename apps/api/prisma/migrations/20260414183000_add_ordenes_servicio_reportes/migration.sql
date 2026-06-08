-- CreateEnum
CREATE TYPE "public"."TipoReporteOrdenServicio" AS ENUM (
  'CLIENTE_AUSENTE',
  'ACCESO_CERRADO',
  'DIRECCION_INCORRECTA',
  'INCONVENIENTE_OPERATIVO',
  'CLIENTE_RECHAZA_SERVICIO',
  'ZONA_INSEGURA',
  'SERVICIO_DUPLICADO',
  'OTRO'
);

-- CreateEnum
CREATE TYPE "public"."EstadoDestinoReporteOrdenServicio" AS ENUM (
  'REPROGRAMADO',
  'CANCELADO'
);

-- CreateTable
CREATE TABLE "public"."ordenes_servicio_reportes" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "empresaId" UUID NOT NULL,
  "ordenServicioId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "tipo" "public"."TipoReporteOrdenServicio" NOT NULL,
  "estadoDestino" "public"."EstadoDestinoReporteOrdenServicio" NOT NULL,
  "descripcion" TEXT,
  "evidenciaPaths" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ordenes_servicio_reportes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordenes_servicio_reportes_tenantId_idx"
ON "public"."ordenes_servicio_reportes"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_reportes_empresaId_idx"
ON "public"."ordenes_servicio_reportes"("empresaId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_reportes_ordenServicioId_idx"
ON "public"."ordenes_servicio_reportes"("ordenServicioId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_reportes_membershipId_idx"
ON "public"."ordenes_servicio_reportes"("membershipId" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_reportes_tipo_idx"
ON "public"."ordenes_servicio_reportes"("tipo" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_reportes_estadoDestino_idx"
ON "public"."ordenes_servicio_reportes"("estadoDestino" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_reportes_occurredAt_idx"
ON "public"."ordenes_servicio_reportes"("occurredAt" ASC);

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio_reportes"
ADD CONSTRAINT "ordenes_servicio_reportes_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio_reportes"
ADD CONSTRAINT "ordenes_servicio_reportes_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "public"."empresas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio_reportes"
ADD CONSTRAINT "ordenes_servicio_reportes_ordenServicioId_fkey"
FOREIGN KEY ("ordenServicioId") REFERENCES "public"."ordenes_servicio"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordenes_servicio_reportes"
ADD CONSTRAINT "ordenes_servicio_reportes_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "public"."tenant_memberships"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
