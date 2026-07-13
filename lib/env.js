import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// En Vercel las env vars vienen inyectadas por la plataforma.
// dotenv solo se necesita para `vercel dev` local leyendo el `.env`.
if (!process.env.VERCEL) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: resolve(__dirname, "..", ".env") });
}

const REQUIRED = ["IG_USER_ID", "IG_ACCESS_TOKEN", "WEBHOOK_VERIFY_TOKEN"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`[env] faltan variables: ${missing.join(", ")}`);
}

if (!process.env.IG_APP_SECRET) {
  console.warn(
    "[env] IG_APP_SECRET vacío — verificación HMAC deshabilitada. Configurar antes de producción."
  );
}

export const env = {
  ig: {
    userId: process.env.IG_USER_ID,
    accessToken: process.env.IG_ACCESS_TOKEN,
    appSecret: process.env.IG_APP_SECRET || null,
    graphVersion: process.env.GRAPH_API_VERSION || "v23.0",
  },
  webhook: {
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
  },
  bot: {
    keyword: (process.env.KEYWORD || "link").toLowerCase(),
    dmUrl: process.env.DM_URL || "https://hs-wiki.vercel.app",
    dmTemplate:
      process.env.DM_MESSAGE_TEMPLATE || "Hey! Acá tienes el link: {url}",
  },
};

export const renderDmMessage = (url = env.bot.dmUrl) =>
  env.bot.dmTemplate.replace("{url}", url);
