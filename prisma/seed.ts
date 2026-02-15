import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "demo@blackdesk.local" },
  });

  if (existing) {
    console.log("Demo user already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);

  await prisma.user.create({
    data: {
      firstName: "Demo",
      lastName: "User",
      username: "demo",
      passwordHash,
      email: "demo@blackdesk.local",
      name: "Demo User",
    },
  });

  console.log("Created demo user: demo@blackdesk.local / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

