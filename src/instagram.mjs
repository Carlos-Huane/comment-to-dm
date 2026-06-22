import { config } from "./config.mjs";

const GRAPH_BASE = `https://graph.instagram.com/${config.ig.graphVersion}`;

async function graphRequest(path, { method = "GET", params = {} } = {}) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const body = new URLSearchParams({ ...params, access_token: config.ig.accessToken });

  const init = { method };
  if (method === "GET") {
    for (const [k, v] of body.entries()) url.searchParams.set(k, v);
  } else {
    init.body = body;
  }

  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message || JSON.stringify(json);
    throw new Error(`Graph API ${method} ${path}: ${msg}`);
  }
  return json;
}

/**
 * Obtiene el texto y autor de un comentario por su ID.
 */
export async function getComment(commentId) {
  return graphRequest(`/${commentId}`, {
    params: { fields: "id,text,username,from,timestamp" },
  });
}

/**
 * Manda una Private Reply al autor de un comentario.
 * Meta restringe: 1 private reply por comentario, máximo 7 días después.
 *
 * @param {string} commentId — ID del comentario que dispara la respuesta
 * @param {string} message — texto del DM (max 1000 chars)
 */
export async function sendPrivateReply(commentId, message) {
  return graphRequest(`/${config.ig.userId}/messages`, {
    method: "POST",
    params: {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify({ text: message }),
    },
  });
}

/**
 * Sanity check: confirma que el token está vivo y devuelve info de la cuenta.
 * Útil al arranque y en /health.
 */
export async function getAccountInfo() {
  return graphRequest("/me", { params: { fields: "user_id,username,account_type" } });
}
