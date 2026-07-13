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
    // Template default cuando la entrada del post-links.json no define uno propio.
    // Soporta placeholders {username} y {url}.
    dmTemplate:
      process.env.DM_MESSAGE_TEMPLATE ||
      "Hey @{username}! Acá tienes lo que pediste: {url}",
  },
  admin: {
    // Secret para proteger endpoints admin (ej. /api/list-recent-posts).
    // Si vacío, esos endpoints devuelven 503.
    secret: process.env.ADMIN_SECRET || null,
  },
};

/**
 * Renderiza el template reemplazando placeholders.
 * @param {string} template
 * @param {{username?: string, url: string}} vars
 */
export function renderDmMessage(template, { username, url }) {
  return template
    .replaceAll("{username}", username || "there")
    .replaceAll("{url}", url);
}
