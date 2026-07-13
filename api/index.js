import { env } from "../lib/env.js";

export default function handler(_req, res) {
  res.status(200).json({
    name: "comment-to-dm",
    status: "running",
    keyword: env.bot.keyword,
    endpoints: {
      health: "/api/health",
      webhook: "/api/webhook",
    },
  });
}
