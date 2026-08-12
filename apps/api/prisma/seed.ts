import { seedEvent } from "./seed-event.js";
import { seedUsers } from "./seed-users.js";
import { prisma } from "../src/database/prisma.js";

try {
  await seedUsers(prisma);
  await seedEvent(prisma);

  console.log("Demonstration data seeded successfully.");
} finally {
  await prisma.$disconnect();
}
