import { prisma } from "../../src/database/prisma.js";

export async function resetDatabase() {
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}
