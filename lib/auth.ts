import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { generateInternalUsername } from "@/lib/internal-username";
import { deriveNameParts, formatDisplayName } from "@/lib/name-utils";

const prismaAdapter = PrismaAdapter(prisma);

const adapter: Adapter = {
  ...prismaAdapter,
  async createUser(data: Omit<AdapterUser, "id">) {
    const email = data.email?.toLowerCase() ?? null;
    const names = deriveNameParts({
      fullName: data.name,
      email,
    });

    const username = await generateInternalUsername(
      email ?? `${names.firstName}${names.lastName}`,
    );

    return prisma.user.create({
      data: {
        username,
        usernameSetupComplete: true,
        firstName: names.firstName,
        lastName: names.lastName,
        email,
        name: formatDisplayName(names.firstName, names.lastName, email),
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
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
          name: formatDisplayName(user.firstName, user.lastName, user.email),
          email: user.email,
          image: user.image,
          firstName: user.firstName,
          lastName: user.lastName,
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

      if (!profileEmail) {
        return "/auth/login?error=GoogleEmailRequired";
      }

      const profileImage =
        typeof rawProfile?.picture === "string"
          ? rawProfile.picture
          : typeof rawProfile?.image === "string"
            ? rawProfile.image
            : null;

      const profileGivenName =
        typeof rawProfile?.given_name === "string" ? rawProfile.given_name : null;
      const profileFamilyName =
        typeof rawProfile?.family_name === "string" ? rawProfile.family_name : null;
      const profileName =
        typeof rawProfile?.name === "string" ? rawProfile.name : null;

      const names = deriveNameParts({
        firstName: profileGivenName,
        lastName: profileFamilyName,
        fullName: profileName,
        email: profileEmail,
      });

      const updateData: {
        email: string;
        firstName: string;
        lastName: string;
        name: string;
        image?: string;
      } = {
        email: profileEmail,
        firstName: names.firstName,
        lastName: names.lastName,
        name: formatDisplayName(names.firstName, names.lastName, profileEmail),
      };

      if (profileImage) {
        updateData.image = profileImage;
      }

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      } catch {
        // Do not block login if profile sync fails.
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.firstName = user.firstName ?? token.firstName;
        token.lastName = user.lastName ?? token.lastName;
        token.email = user.email;
        token.picture = user.image ?? token.picture;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        });

        token.firstName = dbUser?.firstName ?? token.firstName;
        token.lastName = dbUser?.lastName ?? token.lastName;
        token.email = dbUser?.email ?? token.email;
        token.picture = dbUser?.image ?? token.picture;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.firstName = token.firstName ?? "";
        session.user.lastName = token.lastName ?? "";
        session.user.name = formatDisplayName(
          token.firstName,
          token.lastName,
          token.email ?? null,
        );
        session.user.email = token.email ?? null;
        session.user.image =
          typeof token.picture === "string" ? token.picture : null;
      }
      return session;
    },
  },
};
