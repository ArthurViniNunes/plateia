import { hash } from "bcrypt";
import { Router } from "express";

import { prisma } from "../database/prisma.js";
import { registerSchema } from "./register-schema.js";
import { Prisma as PrismaClient } from "../generated/prisma/client.js";

export const authRouter = Router();

authRouter.post("/register", async (request, response) => {
    const result = registerSchema.safeParse(request.body);

    if (!result.success) {
    response.status(400).json({
        error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        },
    });
    return;
    }

    const input = result.data;

    const passwordHash = await hash(input.password, 12);

    try {
    const user = await prisma.user.create({
        data: {
        name: input.name,
        email: input.email,
        passwordHash,
        },
        select: {
        id: true,
        name: true,
        email: true,
        role: true,
        },
    });

    response.status(201).json(user);
    } catch (error: unknown) {
    if (
        error instanceof PrismaClient.PrismaClientKnownRequestError &&
        error.code === "P2002"
    ) {
        response.status(409).json({
        error: {
            code: "EMAIL_ALREADY_REGISTERED",
            message: "Email already registered",
        },
        });
        return;
    }

    throw error;
    }
});