import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { users, userRoles } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginSchema } from "@/lib/validators/auth";
import type { Role } from "@/db/schema/enums";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email dan password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        try {
          const rows = await getDb()
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              passwordHash: users.passwordHash,
              isActive: users.isActive,
              role: userRoles.role,
            })
            .from(users)
            .leftJoin(userRoles, eq(userRoles.userId, users.id))
            .where(
              and(
                eq(users.email, parsed.data.email),
                eq(users.isActive, true),
                isNull(users.deletedAt),
              ),
            );

          const user = rows[0];
          if (!user) return null;

          const valid = await bcrypt.compare(
            parsed.data.password,
            user.passwordHash,
          );
          if (!valid) return null;

          const roles = Array.from(
            new Set(
              rows
                .map((row) => row.role)
                .filter((role): role is Role => role !== null),
            ),
          );

          if (roles.length === 0) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            roles,
          };
        } catch (error) {
          console.error("Gagal memproses login", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? "";
        session.user.roles = token.roles ?? [];
      }
      return session;
    },
  },
});
