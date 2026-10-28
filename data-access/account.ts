import "server-only";

import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";

import { users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getDbPool } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await getDbPool().transaction(async (tx) => {
    const [user] = await tx
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new NotFoundError("Akun tidak ditemukan.");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new ValidationError("Password saat ini tidak sesuai.");
    }

    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw new ValidationError(
        "Password baru harus berbeda dari password saat ini.",
      );
    }

    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await writeAudit(tx, {
      actorId: userId,
      action: "change_password",
      entityType: "user",
      entityId: userId,
    });
  });
}
