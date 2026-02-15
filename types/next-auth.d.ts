import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      usernameSetupComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string;
    usernameSetupComplete?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    usernameSetupComplete?: boolean;
  }
}

