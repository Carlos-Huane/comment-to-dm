import express from "express";
import { config } from "./config.mjs";
import { webhook } from "./webhook.mjs";
import { getAccountInfo } from "./instagram.mjs";

const app = express();

// El body raw es necesario para verificar la firma HMAC. Lo capturamos antes de parsear JSON.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.use("/webhook", webhook);

app.get("/health", async (_req, res) => {
  try {
    const info = await getAccountInfo();
    res.json({ ok: true, ig: info, keyword: config.bot.keyword });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "comment-to-dm",
    status: "running",
    keyword: config.bot.keyword,
    docs: "https://hs-wiki.vercel.app/wiki/proyectos/comment-to-dm",
  });
});

app.listen(config.port, () => {
  console.log(`[server] escuchando en puerto ${config.port}`);
  console.log(`[server] webhook endpoint: /webhook`);
  console.log(`[server] keyword activa: "${config.bot.keyword}"`);
});
