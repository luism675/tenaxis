export type UserRole = "SU_ADMIN" | "ADMIN" | "COORDINADOR" | "ASESOR" | "OPERADOR";

export const PERMISSIONS = {
  // Equipo de Trabajo Permissions
  TEAM_VIEW: ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR"],
  TEAM_CREATE: ["SU_ADMIN", "ADMIN", "COORDINADOR"],
  TEAM_EDIT: ["SU_ADMIN", "ADMIN", "COORDINADOR"],
  TEAM_DELETE: ["SU_ADMIN", "ADMIN"],
  TEAM_EXPORT: ["SU_ADMIN", "ADMIN", "COORDINADOR"],

  // Clientes Permissions
  CLIENT_VIEW: ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR", "OPERADOR"],
  CLIENT_CREATE: ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR"],
  CLIENT_EDIT: ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR"],
  CLIENT_DELETE: ["SU_ADMIN", "ADMIN"],
  CLIENT_EXPORT: ["SU_ADMIN", "ADMIN", "COORDINADOR"],

  // Servicios Permissions
  SERVICE_VIEW: ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR", "OPERADOR"],
  SERVICE_CREATE: ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR"],
  SERVICE_EDIT: ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR"],
  SERVICE_MANAGE: ["SU_ADMIN", "ADMIN", "COORDINADOR"],
  SERVICE_EXPORT: ["SU_ADMIN", "ADMIN", "COORDINADOR"],
};

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Checks if a given role has the specified permission.
 * 
 * @param role The user's role
 * @param action The action/permission to check
 * @returns boolean indicating if the user has permission
 */
export function hasPermission(role: UserRole | undefined | null, action: PermissionKey): boolean {
  if (!role) return false;
  // If role is SU_ADMIN, they generally have access to everything, but we check explicitly to be strict
  if (PERMISSIONS[action]) {
    return PERMISSIONS[action].includes(role);
  }
  return false;
}
