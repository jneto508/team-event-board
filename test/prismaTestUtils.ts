import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSQLite3({
    url: process.env.TEST_DATABASE_URL ?? "file:./prisma/prisma/test/test.db",
  }),
});

export async function resetPrismaEventData(): Promise<void> {
  await prisma.savedEvent.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.rSVP.deleteMany();
  await prisma.event.deleteMany();
}

export async function disconnectPrismaTestDb(): Promise<void> {
  await prisma.$disconnect();
}
