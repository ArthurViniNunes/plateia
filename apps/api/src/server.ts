import "dotenv/config";

import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import { createTicketmasterClient } from "./catalog/ticketmaster-client.js";

const env = parseEnv(process.env);

const catalogClient = createTicketmasterClient(
  env.TICKETMASTER_API_KEY === undefined
    ? {}
    : {
        apiKey: env.TICKETMASTER_API_KEY,
      },
);

const app = createApp({
  corsOrigin: env.CORS_ORIGIN,
  jwtSecret: env.JWT_SECRET,
  catalogClient,
});

app.listen(env.PORT, () => {
  console.log(`Plateia API running on port ${env.PORT}`);
});