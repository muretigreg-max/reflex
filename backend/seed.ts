import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const retailer = await prisma.user.upsert({
    where: { phone: "0700000001" },
    update: {},
    create: {
      name: "Retailer Demo",
      phone: "0700000001",
      email: "retailer@reflex.local",
      password: "demo123",
      role: "RETAILER",
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { phone: "0700000002" },
    update: {},
    create: {
      name: "Dispatcher Demo",
      phone: "0700000002",
      email: "dispatcher@reflex.local",
      password: "demo123",
      role: "DISPATCHER",
    },
  });

  const rider = await prisma.user.upsert({
    where: { phone: "0700000003" },
    update: {},
    create: {
      name: "Rider Demo",
      phone: "0700000003",
      email: "rider@reflex.local",
      password: "demo123",
      role: "RIDER",
    },
  });

  const admin = await prisma.user.upsert({
    where: { phone: "0700000004" },
    update: {},
    create: {
      name: "System Admin",
      phone: "0700000004",
      email: "admin@reflex.local",
      password: "admin123",
      role: "ADMIN",
    },
  });

  console.log("Users created:");
  console.log(retailer);
  console.log(dispatcher);
  console.log(rider);
  console.log(admin);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });