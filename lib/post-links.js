import postLinksData from "../content/post-links.json" with { type: "json" };

/**
 * Resuelve qué URL + mensaje mandar cuando llega un comment.
 *
 * @param {string} mediaId — el media.id del webhook (identificador del post en IG)
 * @returns {{url: string, topic: string|null, message: string|null, isFallback: boolean}}
 */
export function getUrlForMedia(mediaId) {
  const entry = postLinksData.posts?.[mediaId];
  if (entry) {
    return {
      url: entry.url,
      topic: entry.topic ?? null,
      message: entry.message ?? null,
      isFallback: false,
    };
  }
  return {
    url: postLinksData.fallback.url,
    topic: null,
    message: postLinksData.fallback.message ?? null,
    isFallback: true,
  };
}

/**
 * Devuelve el mapa completo. Útil para el endpoint /api/list-recent-posts
 * que marca cuáles posts recientes ya están mapeados.
 */
export function getAllPostLinks() {
  return postLinksData.posts || {};
}
