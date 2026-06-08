-- CreateTable
CREATE TABLE "client_portal_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_portal_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_tokens_tokenHash_key" ON "client_portal_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "client_portal_tokens_tenantId_idx" ON "client_portal_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "client_portal_tokens_clienteId_idx" ON "client_portal_tokens"("clienteId");

-- CreateIndex
CREATE INDEX "client_portal_tokens_empresaId_idx" ON "client_portal_tokens"("empresaId");

-- CreateIndex
CREATE INDEX "client_portal_tokens_tenantId_clienteId_empresaId_idx" ON "client_portal_tokens"("tenantId", "clienteId", "empresaId");

-- CreateIndex
CREATE INDEX "client_portal_tokens_expiresAt_idx" ON "client_portal_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "client_portal_tokens_revokedAt_idx" ON "client_portal_tokens"("revokedAt");

-- AddForeignKey
ALTER TABLE "client_portal_tokens" ADD CONSTRAINT "client_portal_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_tokens" ADD CONSTRAINT "client_portal_tokens_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_tokens" ADD CONSTRAINT "client_portal_tokens_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_tokens" ADD CONSTRAINT "client_portal_tokens_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
