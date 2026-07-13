import { env } from "./env.js";

const GRAPH_BASE = `https://graph.instagram.com/${env.ig.graphVersion}`;

async function graphRequest(path, { method = "GET", params = {} } = {}) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const body = new URLSearchParams({
    ...params,
    access_token: env.ig.accessToken,
  });

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

export async function sendPrivateReply(commentId, message) {
  return graphRequest(`/${env.ig.userId}/messages`, {
    method: "POST",
    params: {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify({ text: message }),
    },
  });
}

export async function getAccountInfo() {
  return graphRequest("/me", {
    params: { fields: "user_id,username,account_type" },
  });
}
