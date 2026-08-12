import { prisma } from "../database/prisma.js";
import { toEventResponse } from "./event-response.js";

export async function listManagedEvents(organizerId: string) {
  const events = await prisma.event.findMany({
    where: {
      organizerId,
    },
    include: {
      _count: {
        select: {
          seats: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    events: events.map(toEventResponse),
  };
}
