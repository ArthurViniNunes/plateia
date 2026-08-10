import "dotenv/config";

import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";

const env = parseEnv(process.env);

const app = createApp({
  corsOrigin: env.CORS_ORIGIN,
});

app.listen(env.PORT, () => {
  console.log(`Plateia API running on port ${env.PORT}`);
});