import { prisma } from "../../src/database/prisma.js";

export async function resetDatabase() {
  await prisma.reservation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}
