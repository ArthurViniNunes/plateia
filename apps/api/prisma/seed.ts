import { seedUsers } from "./seed-users.js";
import { prisma } from "../src/database/prisma.js";

try {
  await seedUsers(prisma);
  console.log("Demonstration users seeded successfully.");
} finally {
  await prisma.$disconnect();
}
