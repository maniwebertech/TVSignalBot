# TVSignalBot — TradingView → WhatsApp Webhook

Receives TradingView alerts and forwards them as WhatsApp messages via MigaStone API.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhook` | Receives TradingView alert → sends WhatsApp |
| GET  | `/api/test`    | Check config status |
| POST | `/api/test`    | Send a real test WhatsApp message |

## Deploy to Vercel

1. Import this repo in [vercel.com/new](https://vercel.com/new)
2. Add these Environment Variables in Vercel dashboard:

| Variable | Value |
|----------|-------|
| `MIGASTONE_URL` | `https://beta.migastone.com` |
| `MIGASTONE_TOKEN` | your API token |
| `MIGASTONE_APP_ID` | `1` |
| `MIGASTONE_LINE_ID` | `1` |
| `WHATSAPP_RECIPIENT` | `+923315110249` |

3. Deploy — Vercel gives you a URL like `https://tv-signal-bot.vercel.app`
4. In TradingView alert → Webhook URL: `https://your-vercel-url/api/webhook`

## TradingView Alert Message Body

Paste exactly this in the TradingView alert **Message** box:

```
{{strategy.order.comment}}
```

Or use the plain text message field — the webhook accepts any plain text body.
