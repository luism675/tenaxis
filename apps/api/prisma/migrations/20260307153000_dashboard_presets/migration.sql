-- CreateEnum
CREATE TYPE "DashboardPresetModule" AS ENUM ('SERVICIOS', 'CLIENTES');

-- CreateTable
CREATE TABLE "dashboard_presets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "module" "DashboardPresetModule" NOT NULL,
    "name" TEXT NOT NULL,
    "color_token" TEXT NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_presets_tenant_id_module_idx" ON "dashboard_presets"("tenant_id", "module");

-- CreateIndex
CREATE INDEX "dashboard_presets_created_by_membership_id_module_idx" ON "dashboard_presets"("created_by_membership_id", "module");

-- CreateIndex
CREATE INDEX "dashboard_presets_tenant_id_module_is_shared_idx" ON "dashboard_presets"("tenant_id", "module", "is_shared");

-- AddForeignKey
ALTER TABLE "dashboard_presets" ADD CONSTRAINT "dashboard_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_presets" ADD CONSTRAINT "dashboard_presets_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "tenant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
