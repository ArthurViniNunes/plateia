import cors from "cors";
import express from "express";
import { authRouter } from "./auth/auth-router.js";

interface CreateAppOptions {
  corsOrigin: string;
}

export function createApp({ corsOrigin }: CreateAppOptions) {
  const app = express();

  app.disable("x-powered-by");

  app.use(express.json());

  app.use(
    cors({
      origin(requestOrigin, callback) {
        if (!requestOrigin || requestOrigin === corsOrigin) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    }),
  );

  app.use("/api/auth", authRouter);

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
    });
  });

  return app;
}