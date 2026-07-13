import { createHmac, timingSafeEqual } from "node:crypto";
import { env, renderDmMessage } from "../lib/env.js";
import { sendPrivateReply } from "../lib/instagram.js";

// Vercel: desactivar el body parser para leer el raw body y poder verificar
// la firma HMAC SHA256 que Meta manda en el header X-Hub-Signature-256.
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method === "GET") return handleVerify(req, res);
  if (req.method === "POST") return handleEvent(req, res);
  return res.status(405).json({ error: "method not allowed" });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/webhook — handshake de verificación de Meta
// ─────────────────────────────────────────────────────────────────────────────
function handleVerify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.webhook.verifyToken) {
    console.log("[webhook] verificación OK");
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(challenge);
  }

  console.warn("[webhook] verificación rechazada");
  return res.status(403).end();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook — eventos reales (comentarios de IG)
// ─────────────────────────────────────────────────────────────────────────────
async function handleEvent(req, res) {
  const raw = await readRawBody(req);

  if (env.ig.appSecret && !verifySignature(req, raw)) {
    console.error("[webhook] firma HMAC inválida — request ignorado");
    // Devolvemos 200 igual: si mandamos 4xx Meta reintenta indefinidamente.
    return res.status(200).end();
  }

  let body;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch (err) {
    console.error("[webhook] body no es JSON:", err.message);
    return res.status(400).end();
  }

  if (body.object !== "instagram") {
    console.warn(`[webhook] object inesperado: ${body.object}`);
    return res.status(200).end();
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === "comments") {
        try {
          await handleCommentEvent(change.value);
        } catch (err) {
          console.error("[webhook] error procesando comentario:", err.message);
        }
      }
    }
  }

  return res.status(200).end();
}

async function handleCommentEvent(value) {
  const commentId = value.id;
  const text = (value.text || "").toLowerCase();
  const author = value.from?.username || value.from?.id || "unknown";

  console.log(`[comment] @${author}: "${value.text}" (id=${commentId})`);

  if (!text.includes(env.bot.keyword)) {
    console.log(`[comment] keyword "${env.bot.keyword}" no detectada`);
    return;
  }

  if (value.from?.id === env.ig.userId) {
    console.log("[comment] comentario propio, skip");
    return;
  }

  const message = renderDmMessage();
  try {
    const result = await sendPrivateReply(commentId, message);
    console.log(
      `[dm] enviado a @${author}, message_id=${result.message_id || result.id || "n/a"}`
    );
  } catch (err) {
    console.error(`[dm] falló envío a @${author}: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function verifySignature(req, rawBody) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    createHmac("sha256", env.ig.appSecret).update(rawBody).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
