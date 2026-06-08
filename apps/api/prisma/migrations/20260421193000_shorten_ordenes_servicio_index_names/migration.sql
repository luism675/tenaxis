-- Rename indexes created in 20260421184500_optimize_ordenes_servicio_filters
-- so Prisma schema validation stays under PostgreSQL's 63-byte identifier limit.

ALTER INDEX "public"."ordenes_servicio_tenantId_empresaId_deletedAt_createdAt_idx"
RENAME TO "os_tenant_empresa_deleted_created_at_idx";

ALTER INDEX "public"."ordenes_servicio_tenantId_empresaId_deletedAt_fechaVisita_idx"
RENAME TO "os_tenant_empresa_deleted_fecha_visita_idx";

ALTER INDEX "public"."ordenes_servicio_tenantId_empresaId_deletedAt_estadoServicio_f_"
RENAME TO "os_tenant_empresa_deleted_estado_servicio_fecha_visita_idx";

ALTER INDEX "public"."ordenes_servicio_tenantId_empresaId_deletedAt_tecnicoId_fech_id"
RENAME TO "os_tenant_empresa_deleted_tecnico_fecha_visita_idx";

ALTER INDEX "public"."ordenes_servicio_tenantId_empresaId_deletedAt_estadoPago_fec_id"
RENAME TO "os_tenant_empresa_deleted_estado_pago_fecha_pago_idx";
