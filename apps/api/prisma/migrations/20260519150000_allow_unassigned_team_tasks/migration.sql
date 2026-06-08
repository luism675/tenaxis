-- Allow operational tasks to remain open without an assigned responsible member.
-- This supports queue-style work where any eligible team member can take the task.
ALTER TABLE "equipo_trabajo_tareas"
  ALTER COLUMN "responsable_membership_id" DROP NOT NULL;
