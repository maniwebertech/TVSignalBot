// ═══════════════════════════════════════════════════════════════════════════════
// Smart Money AI [Naazr] — TradingView Alert → WhatsApp + Supabase
// Account: $10,000 | Risk per trade: $50
// ═══════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const RISK_USD     = 50

// ── Lot size calculator ───────────────────────────────────────────────────────
function calcLots(ticker, entry, sl) {
  const dist = Math.abs(entry - sl)
  if (!dist || dist < 1e-10) return 0.01

  const sym = ticker.replace(/^[A-Z]+:/, '').toUpperCase()

  let pnlPerLot
  if (/XAU|GOLD/.test(sym)) {
    pnlPerLot = dist * 100            // 100 oz/lot
  } else if (/XAG|SILVER/.test(sym)) {
    pnlPerLot = dist * 5000           // 5000 oz/lot
  } else if (/BRENT|WTI|USOIL|UKOIL|OIL|CRUDE/.test(sym)) {
    pnlPerLot = dist * 100            // 100 barrels/lot
  } else if (/US30|DJI|DOW|NAS100|NDX|NASDAQ|US500|SPX|SP500|GER|UK100|JP225/.test(sym)) {
    pnlPerLot = dist * 1              // $1/point (adjust per broker)
  } else if (sym.includes('JPY')) {
    // USDJPY: entry price IS the USDJPY rate → use directly
    // Cross JPY (GBPJPY, EURJPY): entry is the cross rate, NOT USDJPY
    // Must divide by USDJPY to convert JPY P&L to USD — use conservative 150 approximation
    const usdJpyRate = sym.startsWith('USD') ? entry : 150
    pnlPerLot = dist * 100000 / usdJpyRate
  } else if (sym.startsWith('USD')) {
    pnlPerLot = dist * 100000 / entry // USD base pairs
  } else {
    pnlPerLot = dist * 100000         // Standard forex (EUR/GBP/AUD base, USD quote)
  }

  const lots = RISK_USD / pnlPerLot
  return Math.max(0.01, Math.round(lots * 100) / 100)
}

// ── Pip distance helper for display ──────────────────────────────────────────
function pipsStr(ticker, dist) {
  const sym = ticker.replace(/^[A-Z]+:/, '').toUpperCase()
  if (/XAU|GOLD|XAG|SILVER|BRENT|OIL|US30|NAS|SPX|GER|UK100/.test(sym)) {
    return dist.toFixed(2) + ' pts'
  }
  const pip = sym.includes('JPY') ? 0.01 : 0.0001
  return Math.round(dist / pip) + ' pips'
}

// ── Parse event type from alert payload ──────────────────────────────────────
function eventType(event) {
  if (!event) return 'info'
  const e = event.toUpperCase()
  if (e.includes('TRIGGER LONG') || e.includes('LONG BREAK CONFIRM')) return 'trigger_long'
  if (e.includes('TRIGGER SHORT') || e.includes('SHORT BREAK CONFIRM')) return 'trigger_short'
  if (e.includes('LONG BE ARMED'))   return 'be_armed_long'
  if (e.includes('SHORT BE ARMED'))  return 'be_armed_short'
  if (e.includes('LONG TP2 HIT'))    return 'tp2_long'
  if (e.includes('SHORT TP2 HIT'))   return 'tp2_short'
  if (e.includes('LONG SL HIT') || e.includes('LONG BE EXIT'))   return 'sl_long'
  if (e.includes('SHORT SL HIT') || e.includes('SHORT BE EXIT')) return 'sl_short'
  return 'info'
}

// ── WhatsApp message builder ──────────────────────────────────────────────────
function buildTriggerMsg(data, lots, direction) {
  const { ticker, entry, inv, tp1, tp2, quality, htf_bias, mtf_stack, timeframe } = data
  const sl_pips  = pipsStr(ticker, Math.abs(entry - inv))
  const tp1_pips = pipsStr(ticker, Math.abs(tp1 - entry))
  const tp2_pips = pipsStr(ticker, Math.abs(tp2 - entry))
  const arrow = direction === 'LONG' ? '🟢 BUY' : '🔴 SELL'
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')

  return (
    `${arrow} ${ticker}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Entry:  ${entry}\n` +
    `SL:     ${inv}  (${sl_pips})\n` +
    `TP1:    ${tp1}  (+${tp1_pips})\n` +
    `TP2:    ${tp2}  (+${tp2_pips})\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Lots:   ${lots}  |  Risk: $${RISK_USD}\n` +
    `Quality: ${quality || '-'}  |  HTF: ${htf_bias || '-'}\n` +
    `Stack:  ${mtf_stack || '-'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Smart Money AI | ${timeframe || '240'}m | ${now} UTC`
  )
}

function buildBeMsg(data, direction) {
  const { ticker, timeframe } = data
  const arrow = direction === 'LONG' ? '🟢' : '🔴'
  return (
    `⚡ BREAKEVEN ARMED ${arrow} ${ticker} ${direction}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `TP1 reached — SL moved to entry\n` +
    `Risk is now ZERO. Let TP2 run.\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Smart Money AI | ${timeframe || '240'}m`
  )
}

function buildOutcomeMsg(data, direction, isWin, pnlUsd) {
  const { ticker, timeframe } = data
  const pnlSign = pnlUsd >= 0 ? '+' : ''
  if (isWin) {
    return (
      `✅ TP2 HIT — ${ticker} ${direction}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `P&L: ${pnlSign}$${Math.abs(pnlUsd).toFixed(2)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Smart Money AI | ${timeframe || '240'}m`
    )
  }
  const isBeExit = data.event && (data.event.includes('BE EXIT'))
  return (
    `${isBeExit ? '🔶 BREAKEVEN EXIT' : '❌ SL HIT'} — ${ticker} ${direction}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `P&L: ${pnlSign}$${Math.abs(pnlUsd).toFixed(2)}${isBeExit ? ' (Break-even)' : ' (-1R)'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Smart Money AI | ${timeframe || '240'}m`
  )
}

// ── Supabase helper ──────────────────────────────────────────────────────────
async function sb(method, path, body = null) {
  const opts = {
    method,
    headers: {
      apikey:        SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:        body ? 'return=representation' : ''
    }
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, opts)
  if (!r.ok) throw new Error(`Supabase ${method} ${path} → ${r.status}: ${await r.text()}`)
  return r.json().catch(() => null)
}

async function findActiveTrade(ticker, direction) {
  const rows = await sb('GET',
    `/trades?ticker=eq.${encodeURIComponent(ticker)}&direction=eq.${direction}` +
    `&status=in.(TRIGGERED,FILLED,BE_ACTIVE)&order=signal_time.desc&limit=1`
  )
  return rows?.[0] ?? null
}

// ── Send WhatsApp ─────────────────────────────────────────────────────────────
async function sendWhatsApp(message) {
  const body = new URLSearchParams({
    security_token: process.env.MIGASTONE_TOKEN,
    app_id:         process.env.MIGASTONE_APP_ID  || '4',
    line_id:        process.env.MIGASTONE_LINE_ID || '1',
    phone:          process.env.WHATSAPP_RECIPIENT,
    message
  })
  const r = await fetch(
    `${process.env.MIGASTONE_URL}/migawhatsapp/api_send/message`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }
  )
  return r.json().catch(() => ({}))
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    // Parse body
    let raw = ''
    if (typeof req.body === 'string') raw = req.body.trim()
    else if (req.body) raw = JSON.stringify(req.body)
    if (!raw) return res.status(400).json({ error: 'Empty body' })

    let data = {}
    try { data = JSON.parse(raw) } catch { data = { raw } }

    const ev = eventType(data.event)
    console.log(`SMA Alert | ticker=${data.ticker} | event=${data.event} | type=${ev}`)

    if (ev === 'info') {
      return res.status(200).json({ success: true, action: 'ignored', event: data.event })
    }

    const ticker    = data.ticker || 'UNKNOWN'
    const direction = data.side === 'LONG' ? 'LONG' : 'SHORT'
    const now       = new Date().toISOString()

    let waMsg = ''
    let dbResult = null

    // ── TRIGGER (new trade signal) ──────────────────────────────────────────
    if (ev === 'trigger_long' || ev === 'trigger_short') {
      const entry = parseFloat(data.entry)
      const sl    = parseFloat(data.inv)
      const tp1   = parseFloat(data.tp1)
      const tp2   = parseFloat(data.tp2)

      if (!entry || !sl || !tp1 || !tp2) {
        console.warn('Missing prices in TRIGGER payload — prices not included in alert')
        return res.status(200).json({ success: true, action: 'trigger_no_prices', ticker, direction })
      }

      const lots = calcLots(ticker, entry, sl)
      waMsg = buildTriggerMsg({ ...data, entry, inv: sl, tp1, tp2 }, lots, direction)

      if (SUPABASE_URL && SUPABASE_KEY) {
        // Check for existing active trade on same ticker+direction — skip duplicate
        const existing = await findActiveTrade(ticker, direction)
        if (!existing) {
          dbResult = await sb('POST', '/trades', {
            ticker, direction,
            entry_price: entry, sl_price: sl, tp1_price: tp1, tp2_price: tp2,
            lots, risk_usd: RISK_USD,
            quality:    data.quality    || null,
            htf_bias:   data.htf_bias   || null,
            mtf_stack:  data.mtf_stack  || null,
            setup_mode: data.setup_mode || null,
            exec_mode:  data.exec_mode  || null,
            status: 'TRIGGERED',
            signal_time: now,
            raw_message: raw
          })
        } else {
          console.log(`Duplicate signal — active ${direction} trade exists for ${ticker} (id=${existing.id}), skipping DB insert`)
        }
      }
    }

    // ── BREAKEVEN ARMED ─────────────────────────────────────────────────────
    else if (ev === 'be_armed_long' || ev === 'be_armed_short') {
      waMsg = buildBeMsg(data, direction)

      if (SUPABASE_URL && SUPABASE_KEY) {
        const t = await findActiveTrade(ticker, direction)
        if (t) dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`,
          { status: 'BE_ACTIVE', be_time: now })
      }
    }

    // ── TP2 HIT (WIN) ────────────────────────────────────────────────────────
    else if (ev === 'tp2_long' || ev === 'tp2_short') {
      let pnlUsd = RISK_USD * 2  // Estimate 2R; actual varies by phase fib

      if (SUPABASE_URL && SUPABASE_KEY) {
        const t = await findActiveTrade(ticker, direction)
        if (t) {
          // Calculate actual P&L from prices
          if (t.entry_price && t.tp2_price && t.lots) {
            const move = Math.abs(parseFloat(t.tp2_price) - parseFloat(t.entry_price))
            const lots = parseFloat(t.lots)
            const sym = ticker.replace(/^[A-Z]+:/, '').toUpperCase()
            if (/XAU|GOLD/.test(sym)) pnlUsd = move * lots * 100
            else if (/XAG|SILVER/.test(sym)) pnlUsd = move * lots * 5000
            else if (sym.includes('JPY')) pnlUsd = move * lots * 100000 / parseFloat(t.entry_price)
            else pnlUsd = move * lots * 100000
            pnlUsd = Math.round(pnlUsd * 100) / 100
          }
          const pnl_r = t.risk_usd ? Math.round((pnlUsd / parseFloat(t.risk_usd)) * 100) / 100 : 2
          dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`, {
            status: 'TP2_HIT', outcome_time: now, pnl_usd: pnlUsd, pnl_r
          })
        }
      }
      waMsg = buildOutcomeMsg({ ...data, event: data.event }, direction, true, pnlUsd)
    }

    // ── SL HIT / BE EXIT (LOSS or BREAKEVEN) ─────────────────────────────────
    else if (ev === 'sl_long' || ev === 'sl_short') {
      const isBeExit = data.event && (data.event.includes('BE EXIT'))
      const pnlUsd   = isBeExit ? 0 : -RISK_USD
      const newStatus = isBeExit ? 'BE_EXIT' : 'SL_HIT'

      if (SUPABASE_URL && SUPABASE_KEY) {
        const t = await findActiveTrade(ticker, direction)
        if (t) dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`, {
          status: newStatus, outcome_time: now,
          pnl_usd: pnlUsd, pnl_r: isBeExit ? 0 : -1
        })
      }
      waMsg = buildOutcomeMsg({ ...data }, direction, false, pnlUsd)
    }

    // Send WhatsApp
    let waResult = {}
    if (waMsg) {
      waResult = await sendWhatsApp(waMsg)
      if (waResult?.error) console.error('MigaStone error:', waResult)
    }

    return res.status(200).json({ success: true, action: ev, ticker, direction, wa: waResult?.data, db: dbResult })

  } catch (err) {
    console.error('Webhook error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
