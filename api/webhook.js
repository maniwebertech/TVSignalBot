// ═══════════════════════════════════════════════════════════════════════════════
// EBP Strategy — TradingView Alert → WhatsApp + Supabase DB
// ═══════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

// ── Parse incoming alert message ──────────────────────────────────────────────
function parseMessage(msg) {
  if (msg.includes('ENTRY ZONE HIT')) {
    const m = msg.match(/ENTRY ZONE HIT \[Acc (\d+)\] - (\S+) (BUY|SELL)/)
    if (!m) return { type: 'unknown' }
    return { type: 'entry_hit', account_num: +m[1], pair: m[2], direction: m[3] }
  }
  if (msg.includes('TRADE INVALIDATED')) {
    const m = msg.match(/TRADE INVALIDATED \[Acc (\d+)\] - (\S+) (BUY|SELL)/)
    if (!m) return { type: 'unknown' }
    return { type: 'invalidated', account_num: +m[1], pair: m[2], direction: m[3] }
  }
  if (msg.includes('MOVE SL TO BREAKEVEN')) {
    // Format: "⚡ MOVE SL TO BREAKEVEN [Acc N]\nTICKER BUY|SELL - TF\n\n..."
    const m = msg.match(/MOVE SL TO BREAKEVEN \[Acc (\d+)\]\n(\S+) (BUY|SELL)/)
    if (!m) return { type: 'unknown' }
    return { type: 'be', account_num: +m[1], pair: m[2], direction: m[3] }
  }
  if (msg.includes('TP HIT')) {
    const m = msg.match(/TP HIT \[Acc (\d+)\] - (\S+) (BUY|SELL)/)
    if (!m) return { type: 'unknown' }
    const profitM = msg.match(/\+2R \| \$(\d+) profit/)
    return { type: 'tp_hit', account_num: +m[1], pair: m[2], direction: m[3],
             pnl_r: 2, pnl_usd: profitM ? +profitM[1] : null }
  }
  if (msg.includes('SL HIT')) {
    const m = msg.match(/SL HIT \[Acc (\d+)\] - (\S+) (BUY|SELL)/)
    if (!m) return { type: 'unknown' }
    const lossM = msg.match(/-1R \| \$(\d+) loss/)
    const risk = lossM ? +lossM[1] : null
    return { type: 'sl_hit', account_num: +m[1], pair: m[2], direction: m[3],
             pnl_r: -1, pnl_usd: risk ? -risk : null }
  }

  // New EBP signal: "GBPCAD BUY [Acc 2 - $25K]\n\nENTRY: ...\nTP: ...\nSL: ..."
  const headerM = msg.match(/^(\S+) (BUY|SELL) \[Acc (\d+) - \$\w+\]/)
  if (headerM) {
    const pair        = headerM[1]
    const direction   = headerM[2]
    const account_num = +headerM[3]

    const entryM = msg.match(/ENTRY:\s*([\d.]+)/)
    const tpM    = msg.match(/^TP:\s*([\d.]+)/m)
    const slM    = msg.match(/^SL:\s*([\d.]+)/m)
    if (!entryM || !tpM || !slM) return { type: 'unknown' }

    // The line tagged "<< YOUR ACCOUNT" has the lot/risk for this chart's account
    let lots = null, risk_usd = null
    const yourLine = msg.split('\n').find(l => l.includes('<< YOUR ACCOUNT'))
    if (yourLine) {
      const lotM = yourLine.match(/([\d.]+)\s+lots.*\$(\d+)\s+risk/)
      if (lotM) { lots = +lotM[1]; risk_usd = +lotM[2] }
    }

    return {
      type: 'signal', pair, direction, account_num,
      entry_price: +entryM[1], tp_price: +tpM[1], sl_price: +slM[1],
      lots, risk_usd
    }
  }

  return { type: 'unknown' }
}

// ── Supabase REST helper ───────────────────────────────────────────────────────
async function sb(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        body ? 'return=representation' : ''
    }
  }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, opts)
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`Supabase ${method} ${path} → ${r.status}: ${t}`)
  }
  return r.json().catch(() => null)
}

async function findActiveTrade(pair, direction, account_num) {
  const rows = await sb('GET',
    `/trades?pair=eq.${pair}&direction=eq.${direction}&account_num=eq.${account_num}` +
    `&status=in.(PENDING,FILLED,BE_ACTIVE)&order=signal_time.desc&limit=1`
  )
  return rows?.[0] ?? null
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    // Extract alert text from TradingView
    let message = ''
    if (typeof req.body === 'string' && req.body.trim()) {
      message = req.body.trim()
    } else if (req.body?.message) {
      message = String(req.body.message).trim()
    } else if (req.body) {
      message = JSON.stringify(req.body)
    }

    if (!message) return res.status(400).json({ error: 'Empty message' })

    console.log('EBP Alert received:', message.slice(0, 120))

    // Always forward to WhatsApp
    const waBody = new URLSearchParams({
      security_token: process.env.MIGASTONE_TOKEN,
      app_id:         process.env.MIGASTONE_APP_ID  || '4',
      line_id:        process.env.MIGASTONE_LINE_ID || '1',
      phone:          process.env.WHATSAPP_RECIPIENT,
      message
    })
    const waRes = await fetch(
      `${process.env.MIGASTONE_URL}/migawhatsapp/api_send/message`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: waBody.toString() }
    )
    const waResult = await waRes.json().catch(() => ({}))
    if (!waRes.ok || waResult?.error) console.error('MigaStone error:', waResult)

    // Save / update in Supabase
    let dbResult = null
    if (SUPABASE_URL && SUPABASE_KEY) {
      const p = parseMessage(message)
      console.log('Parsed type:', p.type)

      if (p.type === 'signal') {
        dbResult = await sb('POST', '/trades', {
          pair: p.pair, direction: p.direction, account_num: p.account_num,
          entry_price: p.entry_price, tp_price: p.tp_price, sl_price: p.sl_price,
          lots: p.lots, risk_usd: p.risk_usd,
          status: 'PENDING', raw_message: message
        })

      } else if (p.type === 'entry_hit') {
        const t = await findActiveTrade(p.pair, p.direction, p.account_num)
        if (t) dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`,
          { status: 'FILLED', fill_time: new Date().toISOString() })

      } else if (p.type === 'invalidated') {
        const t = await findActiveTrade(p.pair, p.direction, p.account_num)
        if (t) dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`,
          { status: 'INVALIDATED', outcome_time: new Date().toISOString() })

      } else if (p.type === 'be') {
        const t = await findActiveTrade(p.pair, p.direction, p.account_num)
        if (t) dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`,
          { status: 'BE_ACTIVE', be_time: new Date().toISOString() })

      } else if (p.type === 'tp_hit') {
        const t = await findActiveTrade(p.pair, p.direction, p.account_num)
        if (t) dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`, {
          status: 'WIN', outcome_time: new Date().toISOString(),
          pnl_r: 2, pnl_usd: p.pnl_usd
        })

      } else if (p.type === 'sl_hit') {
        const t = await findActiveTrade(p.pair, p.direction, p.account_num)
        if (t) dbResult = await sb('PATCH', `/trades?id=eq.${t.id}`, {
          status: 'LOSS', outcome_time: new Date().toISOString(),
          pnl_r: -1, pnl_usd: p.pnl_usd
        })
      }
    }

    return res.status(200).json({ success: true, migastone: waResult?.data, db: dbResult })

  } catch (err) {
    console.error('Webhook error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
