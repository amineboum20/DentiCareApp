import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAdminUser } from "@/utils/admin-auth";

export const dynamic = "force-dynamic";

// Turns an admin email into the display name used to tag test results.
function adminDisplayName(email: string): string {
  const local = (email.split("@")[0] || "Admin").replace(/[._-]+/g, " ").trim();
  return local.replace(/\b\w/g, (c) => c.toUpperCase()) || "Admin";
}

// Serves the technical workspace HTML, gated to admins only. The file lives
// outside /public so it has no direct public URL.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse("Non autorisé", { status: 403 });

  const name = adminDisplayName(admin.email ?? "");
  const identityScript = `<script>window.__ADMIN_IDENTITY__=${JSON.stringify(name)};</script>`;

  const raw = await readFile(path.join(process.cwd(), "content", "workspace.html"), "utf8");
  // Inject the signed-in admin as the test-runner identity (replaces the old picker).
  const html = raw.replace("<!--ADMIN_IDENTITY-->", identityScript);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
