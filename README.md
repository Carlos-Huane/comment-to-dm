# comment-to-dm

Bot que detecta comentarios con una palabra clave en publicaciones de Instagram y responde con un DM automático con un link. Alternativa propia a ManyChat, usando la **Instagram Graph API directa**.

## Por qué

- "Comenta LINK y te llega un DM con el recurso" es el patrón de growth más usado por creadores en 2026.
- ManyChat cobra desde $15/mes. Esta implementación es gratis (Railway free tier + Graph API directa + creds propias).
- El demo ES el producto: el reel del MVP demuestra el sistema usando ese mismo sistema en tiempo real.

## Arquitectura

```
Instagram (comentario en post)
       ↓ Meta webhook POST
[ Railway: este servicio ]
       ↓ detecta keyword
[ Instagram Graph API: Private Reply ]
       ↓
DM al autor del comentario con link
```

## Stack

- **Node 20+** con ESM (`type: module`)
- **Express 4** para el HTTP server + webhook router
- **Instagram Graph API v23+** (endpoint `graph.instagram.com`)
- Hosting target: **Railway free tier**

## Setup local

```bash
cd PROYECTOS/comment-to-dm
cp .env.example .env
# rellenar .env con creds reales (ver sección Seguridad)
npm install
npm run dev
```

Health check: `curl http://localhost:3000/health` — debe devolver `ok: true` + info de la cuenta IG.

## Seguridad

**Reglas absolutas:**

1. **`.env` nunca se commitea.** Está en `.gitignore`. Si por error lo agregas, **rotar el token de Meta antes de hacer push**.
2. El **access token de Instagram** (`IG_ACCESS_TOKEN`) tiene poder total sobre la cuenta — leer DMs, postear, etc. Tratarlo como password.
3. El **App Secret** (`IG_APP_SECRET`) es necesario para verificar que cada POST viene de Meta (HMAC SHA256). Sin esto, cualquiera con la URL del webhook puede dispararlo. **Configurar antes de exponer el endpoint a internet.**
4. El **Webhook Verify Token** es un string random que tú defines. Generar con `openssl rand -hex 32` y guardar en `.env` + Meta Dev Console.
5. Rate limit de Meta: **200 DMs/hora por cuenta**. Excederlo congela el bot.
6. **Ventana de 7 días** para Private Reply: solo se puede responder a comentarios dentro de los 7 días siguientes a su publicación.

## Endpoints

| Método | Path | Función |
|---|---|---|
| GET | `/` | Status básico (público) |
| GET | `/health` | Sanity check con llamada real a Graph API |
| GET | `/webhook` | Handshake de verificación de Meta (devuelve `hub.challenge`) |
| POST | `/webhook` | Recibe eventos de comentarios, dispara DMs |

## Cómo configurar el webhook en Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com) → tu app → Webhooks
2. Producto: **Instagram**
3. Callback URL: `https://<tu-deploy>.up.railway.app/webhook`
4. Verify Token: el valor de `WEBHOOK_VERIFY_TOKEN` de tu `.env`
5. Suscribirse al campo: **`comments`**
6. Meta hace un GET al endpoint con el verify token → tu servicio debe devolver el `hub.challenge`

## Roadmap

- **Fase 1** (este repo) — uso propio: webhook + detección + DM. No requiere App Review.
- **Fase 2** (futuro) — SaaS multi-tenant: dashboard, pagos, soporte LATAM. Requiere App Review de Meta.

## Estructura

```
comment-to-dm/
├── package.json
├── .env.example      ← template público
├── .env              ← creds reales (gitignored)
├── README.md         ← este archivo
└── src/
    ├── index.mjs     ← Express server, entrypoint
    ├── webhook.mjs   ← handlers GET (verify) + POST (eventos)
    ├── instagram.mjs ← wrapper Graph API: getComment, sendPrivateReply
    └── config.mjs    ← carga .env, valida vars
```
