import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

async function buildTemporaryUsername() {
  let candidate = `u${randomBytes(8).toString("hex")}`;

  while (true) {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    candidate = `u${randomBytes(8).toString("hex")}`;
  }
}

const prismaAdapter = PrismaAdapter(prisma);

const adapter: Adapter = {
  ...prismaAdapter,
  async createUser(data: Omit<AdapterUser, "id">) {
    const email = data.email?.toLowerCase() ?? null;
    const username = await buildTemporaryUsername();

    return prisma.user.create({
      data: {
        username,
        usernameSetupComplete: false,
        email,
        name: data.name ?? null,
        image: data.image ?? null,
        emailVerified: data.emailVerified ?? null,
      },
    });
  },
};

export const authOptions: NextAuthOptions = {
  adapter,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim().toLowerCase();
        const password = credentials?.password;

        if (!username || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? user.username,
          email: user.email,
          image: user.image,
          username: user.username,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user?.id) {
        return true;
      }

      const rawProfile =
        profile && typeof profile === "object"
          ? (profile as Record<string, unknown>)
          : null;

      const profileEmail =
        typeof rawProfile?.email === "string"
          ? rawProfile.email.trim().toLowerCase()
          : null;
      const profileImage =
        typeof rawProfile?.picture === "string"
          ? rawProfile.picture
          : typeof rawProfile?.image === "string"
            ? rawProfile.image
            : null;
      const profileName =
        typeof rawProfile?.name === "string" ? rawProfile.name : null;

      const updateData: {
        email?: string;
        image?: string;
        name?: string;
      } = {};

      if (profileEmail) {
        updateData.email = profileEmail;
      }
      if (profileImage) {
        updateData.image = profileImage;
      }
      if (profileName) {
        updateData.name = profileName;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
        } catch {
          // Do not block login if profile sync fails.
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.username = user.username ?? token.username;
        token.email = user.email;
        token.picture = user.image ?? token.picture;
        token.usernameSetupComplete = user.usernameSetupComplete ?? token.usernameSetupComplete;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            username: true,
            email: true,
            image: true,
            usernameSetupComplete: true,
          },
        });
        token.username = dbUser?.username ?? token.username;
        token.email = dbUser?.email ?? token.email;
        token.picture = dbUser?.image ?? token.picture;
        token.usernameSetupComplete =
          dbUser?.usernameSetupComplete ?? token.usernameSetupComplete;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.username = token.username ?? session.user.name ?? "user";
        session.user.usernameSetupComplete = Boolean(token.usernameSetupComplete);
        session.user.email = token.email ?? null;
        session.user.image =
          typeof token.picture === "string" ? token.picture : null;
      }
      return session;
    },
  },
};

