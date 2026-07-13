import { env } from "../lib/env.js";
import { getAccountInfo } from "../lib/instagram.js";

export default async function handler(_req, res) {
  try {
    const info = await getAccountInfo();
    res.status(200).json({ ok: true, ig: info, keyword: env.bot.keyword });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
