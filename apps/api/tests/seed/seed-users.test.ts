import { compare } from "bcrypt";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { seedUsers } from "../../prisma/seed-users.js";
import { prisma } from "../../src/database/prisma.js";

import { resetDatabase } from "../helpers/reset-database.js";

describe("seedUsers", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the four demonstration accounts idempotently", async () => {
    await seedUsers(prisma);
    await seedUsers(prisma);

    const users = await prisma.user.findMany({
      orderBy: {
        email: "asc",
      },
    });

    expect(users).toHaveLength(4);
    expect(
      users.map(({ name, email, role }) => ({
        name,
        email,
        role,
      })),
    ).toEqual([
      {
        name: "Cliente Plateia 1",
        email: "customer1@plateia.local",
        role: "CUSTOMER",
      },
      {
        name: "Cliente Plateia 2",
        email: "customer2@plateia.local",
        role: "CUSTOMER",
      },
      {
        name: "Portaria Plateia",
        email: "gatekeeper@plateia.local",
        role: "GATEKEEPER",
      },
      {
        name: "Organizador Plateia",
        email: "organizer@plateia.local",
        role: "ORGANIZER",
      },
    ]);

    for (const user of users) {
      expect(await compare("Plateia123!", user.passwordHash)).toBe(true);
    }
  });
});
