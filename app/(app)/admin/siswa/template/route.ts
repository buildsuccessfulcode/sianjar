import { buildStudentImportTemplate } from "@/lib/excel/students";
import { auth } from "@/lib/auth";
import type { Role } from "@/db/schema/enums";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const roles = (session.user.roles ?? []) as Role[];
  if (!hasPermission(roles, "manage:master_data")) {
    return new Response("Forbidden", { status: 403 });
  }

  const file = await buildStudentImportTemplate();
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="template-import-siswa.xlsx"',
      "Content-Length": String(file.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
