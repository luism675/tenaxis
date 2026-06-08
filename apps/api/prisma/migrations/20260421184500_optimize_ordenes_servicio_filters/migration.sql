-- CreateIndex
CREATE INDEX "ordenes_servicio_tenantId_empresaId_deletedAt_createdAt_idx"
ON "public"."ordenes_servicio"("tenantId" ASC, "empresaId" ASC, "deletedAt" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_tenantId_empresaId_deletedAt_fechaVisita_idx"
ON "public"."ordenes_servicio"("tenantId" ASC, "empresaId" ASC, "deletedAt" ASC, "fechaVisita" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_tenantId_empresaId_deletedAt_estadoServicio_f_idx"
ON "public"."ordenes_servicio"("tenantId" ASC, "empresaId" ASC, "deletedAt" ASC, "estadoServicio" ASC, "fechaVisita" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_tenantId_empresaId_deletedAt_tecnicoId_fech_idx"
ON "public"."ordenes_servicio"("tenantId" ASC, "empresaId" ASC, "deletedAt" ASC, "tecnicoId" ASC, "fechaVisita" ASC);

-- CreateIndex
CREATE INDEX "ordenes_servicio_tenantId_empresaId_deletedAt_estadoPago_fec_idx"
ON "public"."ordenes_servicio"("tenantId" ASC, "empresaId" ASC, "deletedAt" ASC, "estadoPago" ASC, "fechaPago" ASC);
