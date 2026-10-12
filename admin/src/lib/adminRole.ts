export type AdminRole = "admin" | "superadmin";

export function isAdminRole(role: unknown): role is AdminRole {
  return role === "admin" || role === "superadmin";
}
