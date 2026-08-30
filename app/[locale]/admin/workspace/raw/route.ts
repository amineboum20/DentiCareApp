import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAdminUser } from "@/utils/admin-auth";

export const dynamic = "force-dynamic";

// Serves the technical workspace HTML, gated to admins only. The file lives
// outside /public so it has no direct public URL.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse("Non autorisé", { status: 403 });

  const html = await readFile(path.join(process.cwd(), "content", "workspace.html"), "utf8");
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
