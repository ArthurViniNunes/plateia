import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../database/prisma.js";
import { toEventResponse } from "./event-response.js";
import type { ListEventsQuery } from "./list-events-query-schema.js";

export async function listPublicEvents({
  search,
  city,
  startsFrom,
  startsTo,
  page,
  limit,
}: ListEventsQuery) {
  const startsAt: Prisma.DateTimeFilter = {
    gt: new Date(),
    ...(startsFrom ? { gte: startsFrom } : {}),
    ...(startsTo ? { lte: startsTo } : {}),
  };

  const where: Prisma.EventWhereInput = {
    status: "PUBLISHED",
    startsAt,
    ...(search
      ? {
          title: {
            contains: search,
            mode: "insensitive",
          },
        }
      : {}),
    ...(city
      ? {
          city: {
            equals: city,
            mode: "insensitive",
          },
        }
      : {}),
  };

  const [total, events] = await prisma.$transaction([
    prisma.event.count({
      where,
    }),
    prisma.event.findMany({
      where,
      include: {
        _count: {
          select: {
            seats: true,
          },
        },
      },
      orderBy: [
        {
          startsAt: "asc",
        },
        {
          id: "asc",
        },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: events.map(toEventResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
