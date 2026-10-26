import type { DefaultSession } from "next-auth";

import type { Role } from "@/db/schema/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
    } & DefaultSession["user"];
  }

  interface User {
    roles: Role[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: Role[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    roles?: Role[];
  }
}
