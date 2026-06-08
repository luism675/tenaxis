-- Soft delete restringido para órdenes de servicio
ALTER TABLE "ordenes_servicio"
ADD COLUMN "deletedById" UUID,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedReason" TEXT;

ALTER TABLE "ordenes_servicio"
ADD CONSTRAINT "ordenes_servicio_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "tenant_memberships"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "ordenes_servicio_deletedAt_idx"
ON "ordenes_servicio"("deletedAt");
