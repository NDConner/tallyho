import "server-only";

/** Emails designated as super-admins, from the ADMIN_EMAILS env var
 *  (comma-separated). Set it on Render and in .env.local. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether this email has super-admin access (the admin console). */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
