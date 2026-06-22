import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const REQUIRED = ["IG_USER_ID", "IG_ACCESS_TOKEN", "WEBHOOK_VERIFY_TOKEN"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[config] faltan variables en .env: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.IG_APP_SECRET) {
  console.warn(
    "[config] IG_APP_SECRET vacío — la verificación HMAC de webhooks está DESHABILITADA. " +
      "Solo aceptable en desarrollo local. Antes de exponer el endpoint a internet, configurar."
  );
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
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
    dmTemplate: process.env.DM_MESSAGE_TEMPLATE || "Hey! Acá está el link: {url}",
  },
};

export const renderDmMessage = (url = config.bot.dmUrl) =>
  config.bot.dmTemplate.replace("{url}", url);
