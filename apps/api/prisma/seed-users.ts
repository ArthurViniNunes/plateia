import { hash } from "bcrypt";

import { Role, type PrismaClient } from "../src/generated/prisma/client.js";

const demonstrationPassword = "Plateia123!";

const demonstrationUsers = [
  {
    name: "Organizador Plateia",
    email: "organizer@plateia.local",
    role: Role.ORGANIZER,
  },
  {
    name: "Cliente Plateia 1",
    email: "customer1@plateia.local",
    role: Role.CUSTOMER,
  },
  {
    name: "Cliente Plateia 2",
    email: "customer2@plateia.local",
    role: Role.CUSTOMER,
  },
  {
    name: "Portaria Plateia",
    email: "gatekeeper@plateia.local",
    role: Role.GATEKEEPER,
  },
] as const;

export async function seedUsers(database: PrismaClient): Promise<void> {
  for (const user of demonstrationUsers) {
    const passwordHash = await hash(demonstrationPassword, 12);

    await database.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
      },
    });
  }
}
