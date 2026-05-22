# Smart Money AI [Naazr] v3.0 — Project Context for Claude

## What This Project Is

Omar Agag's EBP (Engulfing Bar Play) swing trading system. Two components:

1. **Pine Script indicator** (`OmarAgag_EBP_Strategy.pine`) — runs inside TradingView
2. **Webhook bridge** (`api/`) — deployed on Vercel, receives TradingView alerts and forwards them as WhatsApp messages via the MigaStone API

## Alert Flow

```
TradingView candle closes
    → EBP signal detected (barstate.isconfirmed)
    → alert() fires with ENTRY/TP/SL + lot sizes
    → TradingView POSTs to Vercel webhook URL
    → /api/webhook.js calls MigaStone API
    → WhatsApp message arrives on +923315110249
```

## EBP Strategy Rules

- **Bullish EBP**: low sweeps prev low AND close > prev candle body high
- **Bearish EBP**: high sweeps prev high AND close < prev candle body low
- **Strong EBP+** (wick ≤ 15%): entry at 25%, SL at 100% (candle low/high)
- **Weak EBP** (wick > 15%): entry at 50%, SL at 100% (candle low/high)
- **TP**: always 2R (2× the SL distance above/below entry)
- **Break-even**: move SL to entry when new HH (bull) or new LL (bear) forms

## Lot Size Formula

```
lots = (accountBalance × riskPercent%) / (SLdistance × contractSize × pointValue)
```

Auto contract size detection by ticker:
- XAU/GOLD → 100 (oz per lot)
- XAG/SILVER → 5000
- Indices / Crypto → 1
- Forex (default) → 100,000

## Alert Types (all use `alert()` function, caught by `Any alert() function call`)

| Alert | Trigger |
|---|---|
| **EBP Signal** | New confirmed EBP candle — includes ENTRY/TP/SL + 3 account lot sizes |
| **Entry Zone Hit** | Price touches entry level after signal — "check your fill" |
| **Trade Invalidated** | Price moves 1R+ in profit direction without filling entry — "cancel limit order" |
| **Move SL to BE** | New Higher High (bull) or Lower Low (bear) while trade is active |

## Trade Simulation (for dashboard stats)

Status codes in `tStatus` array:
- `0` = pending (signal fired, waiting for fill)
- `1` = active (entry filled, waiting for TP or SL)
- `2` = win (TP hit at 2R)
- `3` = loss (SL hit)
- `4` = expired (new signal fired before fill, OR price moved 1R without fill)

**Win Rate = sWins / (sWins + sLosses)** — only counts status 2 and 3 (filled-then-resolved). Pending and expired trades do NOT affect win rate.

## Webhook — Vercel Deployment

**Live URL**: https://tv-signal-bot.vercel.app

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/webhook` | POST | Receives TradingView alert body → sends WhatsApp |
| `/api/test` | GET | Shows config/status |
| `/api/test` | POST | Sends a real test WhatsApp message |

## Environment Variables (set in Vercel dashboard)

| Variable | Value |
|---|---|
| `MIGASTONE_URL` | `https://beta.migastone.com` |
| `MIGASTONE_TOKEN` | API token from MigaStone → Settings → API Settings |
| `MIGASTONE_APP_ID` | `4` |
| `MIGASTONE_LINE_ID` | `1` |
| `WHATSAPP_RECIPIENT` | `+923315110249` |

## MigaStone API

- Endpoint: `POST /migawhatsapp/api_send/message`
- Content-Type: `application/x-www-form-urlencoded`
- Fields: `security_token`, `app_id`, `line_id`, `phone` (with + country code), `message`
- Success response: `{"error": null, "data": {"status": "success"}}`

## TradingView Alert Setup (per pair)

1. Open pair chart on 4H with EBP indicator loaded
2. Click Alert → Condition: `Omar Agag EBP Strategy` → `Any alert() function call`
3. Interval: `Same as chart` (4 hours)
4. Webhook URL: `https://tv-signal-bot.vercel.app/api/webhook`
5. Message: leave default (overridden by `alert()` dynamic message)

## Watchlist Pairs (configurable in indicator settings)

Default: GBPCAD, AUDCHF, EURUSD, NZDJPY — shown in bottom-right table with live EBP state.

## Key Files

```
OmarAgag_EBP_Strategy.pine   ← paste into TradingView Pine Script editor
api/webhook.js               ← main Vercel serverless function
api/test.js                  ← test/status endpoint
vercel.json                  ← Vercel routing config
package.json                 ← Node.js 18+ required
.env.example                 ← environment variable template
```

## GitHub Repo

https://github.com/maniwebertech/TVSignalBot
Owner: maniwebertech (Imran Rasheed / imran@migastone.com)
