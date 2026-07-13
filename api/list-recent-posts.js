import { env } from "../lib/env.js";
import { getRecentMedia } from "../lib/instagram.js";
import { getAllPostLinks } from "../lib/post-links.js";

/**
 * GET /api/list-recent-posts?secret=XXX
 *
 * Lista los últimos posts de la cuenta configurada, marcando cuáles ya tienen
 * un link mapeado en content/post-links.json.
 *
 * Sirve para: cuando publicás un post nuevo, llamás este endpoint desde el
 * celular → obtenés el media_id + permalink → los agregás al JSON en el repo.
 *
 * Protegido con ?secret=XXX contra ADMIN_SECRET (env var).
 * Si ADMIN_SECRET no está seteado, el endpoint devuelve 503.
 */
export default async function handler(req, res) {
  if (!env.admin.secret) {
    return res.status(503).json({
      error: "ADMIN_SECRET no configurado",
      hint: "seteá ADMIN_SECRET en Vercel env vars para habilitar este endpoint",
    });
  }

  const provided = req.query.secret;
  if (provided !== env.admin.secret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const posts = await getRecentMedia(25);
    const mappedIds = new Set(Object.keys(getAllPostLinks()));

    const annotated = posts.map((p) => ({
      id: p.id,
      permalink: p.permalink,
      media_type: p.media_type,
      timestamp: p.timestamp,
      caption_preview: (p.caption || "").slice(0, 120),
      mapped: mappedIds.has(p.id),
    }));

    const summary = {
      total: annotated.length,
      mapped: annotated.filter((p) => p.mapped).length,
      unmapped: annotated.filter((p) => !p.mapped).length,
    };

    return res.status(200).json({ summary, posts: annotated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
