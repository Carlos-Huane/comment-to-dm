import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config, renderDmMessage } from "./config.mjs";
import { sendPrivateReply } from "./instagram.mjs";

export const webhook = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /webhook — handshake de verificación de Meta
// Cuando configuras el webhook en Meta Dev Console, Meta hace este GET una vez
// con hub.mode=subscribe y un challenge. Hay que devolver el challenge en plaintext.
// ─────────────────────────────────────────────────────────────────────────────
webhook.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.webhook.verifyToken) {
    console.log("[webhook] verificación OK");
    return res.status(200).type("text/plain").send(challenge);
  }

  console.warn("[webhook] verificación rechazada", { mode, tokenMatch: token === config.webhook.verifyToken });
  return res.sendStatus(403);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhook — eventos reales de Instagram (comentarios, mensajes, etc.)
// Meta firma cada request con HMAC SHA256 en el header X-Hub-Signature-256.
// Si el App Secret está configurado, verificamos. Si no, se loguea warning.
// ─────────────────────────────────────────────────────────────────────────────
webhook.post("/", async (req, res) => {
  // Responder rápido a Meta (timeout es 20s, pero conviene devolver 200 ASAP).
  res.sendStatus(200);

  if (config.ig.appSecret && !verifySignature(req)) {
    console.error("[webhook] firma HMAC inválida — request ignorado");
    return;
  }

  const body = req.body;
  if (body.object !== "instagram") {
    console.warn(`[webhook] object inesperado: ${body.object}`);
    return;
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === "comments") {
        await handleCommentEvent(change.value).catch((err) =>
          console.error("[webhook] error procesando comentario:", err.message)
        );
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Lógica del bot: detectar keyword en el comentario → mandar DM
// ─────────────────────────────────────────────────────────────────────────────
async function handleCommentEvent(value) {
  const commentId = value.id;
  const text = (value.text || "").toLowerCase();
  const author = value.from?.username || value.from?.id || "unknown";

  console.log(`[comment] @${author}: "${value.text}" (id=${commentId})`);

  if (!text.includes(config.bot.keyword)) {
    console.log(`[comment] keyword "${config.bot.keyword}" no detectada, skip`);
    return;
  }

  // Evitar auto-respuesta si el comentario es de la propia cuenta.
  if (value.from?.id === config.ig.userId) {
    console.log("[comment] comentario propio, skip");
    return;
  }

  const message = renderDmMessage();
  try {
    const result = await sendPrivateReply(commentId, message);
    console.log(`[dm] enviado a @${author}, message_id=${result.message_id || result.id || "n/a"}`);
  } catch (err) {
    console.error(`[dm] falló envío a @${author}: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificación HMAC: confirma que el POST viene realmente de Meta
// ─────────────────────────────────────────────────────────────────────────────
function verifySignature(req) {
  const signature = req.get("x-hub-signature-256");
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected = "sha256=" + createHmac("sha256", config.ig.appSecret)
    .update(req.rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
