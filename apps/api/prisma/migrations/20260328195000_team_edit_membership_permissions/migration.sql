CREATE TYPE "MembershipPermission" AS ENUM ('TEAM_EDIT');

ALTER TABLE "tenant_memberships"
ADD COLUMN "granular_permissions" "MembershipPermission"[] NOT NULL DEFAULT ARRAY[]::"MembershipPermission"[];
