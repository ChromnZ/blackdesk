import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

function baseUsername(input: string) {
  const sanitized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  return sanitized.length > 0 ? sanitized : "user";
}

async function buildUniqueUsername(seed: string) {
  const base = baseUsername(seed);
  let candidate = base;

  while (true) {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }

    const suffix = randomBytes(2).toString("hex");
    const maxBaseLength = Math.max(1, 20 - suffix.length - 1);
    candidate = `${base.slice(0, maxBaseLength)}_${suffix}`;
  }
}

const prismaAdapter = PrismaAdapter(prisma);

const adapter: Adapter = {
  ...prismaAdapter,
  async createUser(data: Omit<AdapterUser, "id">) {
    const email = data.email?.toLowerCase() ?? null;
    const seed = email?.split("@")[0] ?? data.name ?? "user";
    const username = await buildUniqueUsername(seed);

    return prisma.user.create({
      data: {
        username,
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
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.username = user.username ?? token.username;
      }

      if (token.sub && !token.username) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { username: true },
        });
        token.username = dbUser?.username;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.username = token.username ?? session.user.name ?? "user";
      }
      return session;
    },
  },
};

