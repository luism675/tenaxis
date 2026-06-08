-- CreateIndex
CREATE INDEX IF NOT EXISTS "empresas_tenantId_deletedAt_idx"
ON "public"."empresas"("tenantId" ASC, "deletedAt" ASC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evidencias_servicio_tenantId_ordenServicioId_idx"
ON "public"."evidencias_servicio"("tenantId" ASC, "ordenServicioId" ASC);
