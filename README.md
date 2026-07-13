# comment-to-dm

Bot que detecta comentarios con una palabra clave en publicaciones de Instagram y responde con un DM automático con un link. Alternativa propia a ManyChat, usando la **Instagram Graph API directa** desplegada como funciones serverless en **Vercel** (free tier).

## Por qué

- "Comenta LINK y te llega un DM con el recurso" es el patrón de growth más usado por creadores en 2026.
- ManyChat cobra desde $15/mes. Esta implementación corre gratis en Vercel Hobby + Graph API con creds propias.
- El demo ES el producto: el reel del MVP demuestra el sistema usando ese mismo sistema en tiempo real.

## Arquitectura

```
Instagram (comentario en post)
       ↓ Meta webhook POST
[ Vercel serverless: /api/webhook ]
       ↓ detecta keyword
[ Instagram Graph API: Private Reply ]
       ↓
DM al autor del comentario con link
```

## Stack

- **Node 20** con ESM
- **Vercel serverless functions** (auto-detectadas en `api/`)
- **Instagram Graph API v23+** (endpoint `graph.instagram.com`)
- Hosting: **Vercel Hobby** (100 GB-h/mes, más que suficiente para este workload)

## Estructura

```
comment-to-dm/
├── package.json
├── .env.example       ← template público
├── .env               ← creds reales (gitignored)
├── README.md
├── api/               ← funciones serverless, Vercel las expone en /api/*
│   ├── index.js       → GET /api/           (status)
│   ├── health.js      → GET /api/health     (sanity check con Graph API)
│   └── webhook.js     → GET+POST /api/webhook (verify + eventos)
└── lib/               ← helpers importados por los handlers
    ├── env.js         (valida y expone env vars)
    └── instagram.js   (wrapper Graph API: sendPrivateReply, getAccountInfo)
```

## Setup local

```bash
cd PROYECTOS/comment-to-dm
cp .env.example .env
# rellenar .env con creds reales (ver sección Seguridad)

npm install
npm install -g vercel   # una vez, la CLI global
npm run dev             # equivale a `vercel dev`, corre las functions en localhost
```

Health check local: `curl http://localhost:3000/api/health` — debe devolver `ok: true` + info de la cuenta IG.

## Deploy a Vercel

Primera vez:

```bash
npm install -g vercel
vercel login            # con tu cuenta de GitHub
vercel                  # crea el proyecto, preview URL
```

Setear env vars en el dashboard (Project → Settings → Environment Variables) con los mismos nombres que están en `.env.example`. Aplicar a `Production` y `Preview`.

Deploys siguientes:

```bash
npm run deploy          # equivale a `vercel --prod`
```

O bien conectar el repo a Vercel: cada `git push` al branch principal dispara deploy automático (mismo patrón que hs-wiki).

## Seguridad

**Reglas absolutas:**

1. **`.env` nunca se commitea.** Está en `.gitignore`. Si por error lo agregas, **rotar el token de Meta antes de push**.
2. El **access token de Instagram** (`IG_ACCESS_TOKEN`) tiene poder total sobre la cuenta — leer DMs, postear, etc. Tratarlo como password.
3. El **App Secret** (`IG_APP_SECRET`) verifica la firma HMAC SHA256 de cada POST de Meta. Sin esto, cualquiera con la URL del webhook puede dispararlo. **Configurar antes de exponer el endpoint a internet.**
4. El **Webhook Verify Token** es un string random que tú defines. Generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guardarlo en `.env` + Meta Dev Console (mismo valor en los dos lados).
5. Rate limit de Meta: **200 DMs/hora por cuenta**. Excederlo congela el bot.
6. **Ventana de 7 días** para Private Reply: solo se puede responder a comentarios dentro de los 7 días siguientes a su publicación.

## Endpoints

Todos bajo la URL de Vercel: `https://<tu-deploy>.vercel.app`.

| Método | Path | Función |
|---|---|---|
| GET | `/api` | Status básico (público, JSON) |
| GET | `/api/health` | Sanity check con llamada real a Graph API |
| GET | `/api/webhook` | Handshake de verificación de Meta (devuelve `hub.challenge`) |
| POST | `/api/webhook` | Recibe eventos de comentarios, dispara DMs |

## Configurar el webhook en Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com) → tu app → Webhooks
2. Producto: **Instagram**
3. Callback URL: `https://<tu-deploy>.vercel.app/api/webhook`
4. Verify Token: el valor de `WEBHOOK_VERIFY_TOKEN` de tu `.env` / Vercel env
5. Suscribirse al campo: **`comments`**
6. Meta hace un GET al endpoint con el verify token → tu función devuelve el `hub.challenge`

## Roadmap

- **Fase 1** (este repo, deploy Vercel) — uso propio: webhook + detección + DM. No requiere App Review.
- **Fase 2** (futuro) — SaaS multi-tenant: dashboard, pagos, soporte LATAM. Requiere App Review de Meta.
