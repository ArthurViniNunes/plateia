import cors from "cors";
import express from "express";

interface CreateAppOptions {
  corsOrigin: string;
}

export function createApp({ corsOrigin }: CreateAppOptions) {
  const app = express();

  app.disable("x-powered-by");

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

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
    });
  });

  return app;
}