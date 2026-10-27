import { buildStudentImportTemplate } from "@/lib/excel/students";
import { auth } from "@/lib/auth";
import { listClasses } from "@/data-access/master";
import type { Role } from "@/db/schema/enums";
import { hasPermission } from "@/lib/permissions";
import { classLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const roles = (session.user.roles ?? []) as Role[];
  if (!hasPermission(roles, "manage:master_data")) {
    return new Response("Forbidden", { status: 403 });
  }

  const yearId = new URL(request.url).searchParams.get("year")?.trim();
  const classes = yearId ? await listClasses(yearId) : [];
  const file = await buildStudentImportTemplate(
    classes.map((row) => ({ label: classLabel(row) })),
  );
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
