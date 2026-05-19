// ═══════════════════════════════════════════════════════════════════════════════
// EBP Strategy — TradingView Alert → WhatsApp (via MigaStone API)
// Deploy the /webhook folder on Vercel
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = async (req, res) => {

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  try {
    // ── Extract alert message from TradingView ────────────────────────────────
    let message = ''
    if (typeof req.body === 'string' && req.body.trim()) {
      message = req.body.trim()
    } else if (req.body?.message) {
      message = String(req.body.message).trim()
    } else if (req.body) {
      message = JSON.stringify(req.body)
    }

    if (!message) {
      return res.status(400).json({ error: 'Empty message received from TradingView' })
    }

    console.log('EBP Alert received:', message.slice(0, 100))

    // ── MigaStone API call ────────────────────────────────────────────────────
    // POST to /migawhatsapp/api_send/message with form-data
    const apiUrl = `${process.env.MIGASTONE_URL}/migawhatsapp/api_send/message`

    const body = new URLSearchParams({
      security_token: process.env.MIGASTONE_TOKEN,
      app_id:         process.env.MIGASTONE_APP_ID  || '1',
      line_id:        process.env.MIGASTONE_LINE_ID || '1',
      phone:          process.env.WHATSAPP_RECIPIENT,  // e.g. +923315110249
      message:        message
    })

    const response = await fetch(apiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString()
    })

    const result = await response.json().catch(() => ({}))

    // MigaStone returns { error: null, data: { status: "success" } } on success
    if (!response.ok || result?.error) {
      console.error('MigaStone error:', result)
      return res.status(502).json({ error: 'MigaStone API failed', detail: result })
    }

    console.log('WhatsApp sent OK to', process.env.WHATSAPP_RECIPIENT)
    return res.status(200).json({ success: true, migastone: result?.data })

  } catch (err) {
    console.error('Webhook error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
