-- Scope client phone uniqueness to the active company instead of the whole tenant/global table.
ALTER TABLE "public"."clientes" DROP CONSTRAINT IF EXISTS "clientes_telefono_key";
ALTER TABLE "public"."clientes" DROP CONSTRAINT IF EXISTS "clientes_tenantId_telefono_key";

DROP INDEX IF EXISTS "public"."clientes_telefono_key";
DROP INDEX IF EXISTS "public"."clientes_tenantId_telefono_key";

CREATE INDEX IF NOT EXISTS "clientes_tenantId_empresaId_telefono_idx"
ON "public"."clientes"("tenantId", "empresaId", "telefono");

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_tenant_empresa_telefono_active_key"
ON "public"."clientes"("tenantId", "empresaId", "telefono")
WHERE "deletedAt" IS NULL AND "empresaId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_tenant_telefono_active_no_empresa_key"
ON "public"."clientes"("tenantId", "telefono")
WHERE "deletedAt" IS NULL AND "empresaId" IS NULL;
