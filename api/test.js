// ── Test endpoint ─────────────────────────────────────────────────────────────
// GET  /api/test  → shows config status (no message sent)
// POST /api/test  → sends a real test WhatsApp message to verify everything works

module.exports = async (req, res) => {

  // GET — show config
  if (req.method === 'GET') {
    return res.status(200).json({
      status:            '✅ EBP Webhook is running',
      migastone_url:     process.env.MIGASTONE_URL     || '❌ NOT SET',
      token_set:         process.env.MIGASTONE_TOKEN   ? '✅ SET' : '❌ NOT SET',
      app_id:            process.env.MIGASTONE_APP_ID  || '1 (default)',
      line_id:           process.env.MIGASTONE_LINE_ID || '1 (default)',
      recipient:         process.env.WHATSAPP_RECIPIENT || '❌ NOT SET',
      webhook_endpoint:  '/api/webhook  ← paste this URL in TradingView',
      how_to_test:       'Send POST to /api/test to fire a real WhatsApp test'
    })
  }

  // POST — send real test message
  if (req.method === 'POST') {
    try {
      const testMessage =
        '✅ EBP Webhook Test\n\n' +
        'XAUUSD SELL\n\n' +
        'ENTRY: 2645.30\n' +
        'TP: 2601.50\n' +
        'SL: 2667.40\n\n' +
        '$100K LOT SIZE: 0.45 lots ($1000 risk)\n' +
        '$25K LOT SIZE: 0.06 lots ($125 risk)\n' +
        '$10K LOT SIZE: 0.02 lots ($50 risk)\n\n' +
        'If you got this on WhatsApp, your webhook is fully working!'

      const apiUrl = `${process.env.MIGASTONE_URL}/migawhatsapp/api_send/message`
      const body = new URLSearchParams({
        security_token: process.env.MIGASTONE_TOKEN,
        app_id:         process.env.MIGASTONE_APP_ID  || '1',
        line_id:        process.env.MIGASTONE_LINE_ID || '1',
        phone:          process.env.WHATSAPP_RECIPIENT,
        message:        testMessage
      })

      const r = await fetch(apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString()
      })

      const result = await r.json().catch(() => ({}))

      if (!r.ok || result?.error) {
        return res.status(502).json({ error: 'MigaStone API failed', detail: result })
      }

      return res.status(200).json({
        success:  true,
        message:  '✅ Test WhatsApp sent! Check your phone.',
        response: result?.data
      })

    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Use GET to check status or POST to send test' })
}
