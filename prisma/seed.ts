import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: "demo" },
  });

  if (existing) {
    console.log("Demo user already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);

  await prisma.user.create({
    data: {
      username: "demo",
      passwordHash,
      name: "Demo User",
      email: "demo@blackdesk.local",
    },
  });

  console.log("Created demo user: demo / demo1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

