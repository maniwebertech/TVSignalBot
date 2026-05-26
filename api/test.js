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

  // POST — send real test message (CRT NAS100 sample)
  if (req.method === 'POST') {
    try {
      // Simulated CRT 15M BUY signal on NAS100
      // SL dist = 12 pts  →  lots = 50 / (12 × 10) = 0.42
      const now = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }) + ' NY'
      const testMessage =
        `🟢 *BUY* *NAS100*  @  0.42 lots\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 Entry:   29854.15\n` +
        `🎯 TP:      29872.15\n` +
        `🛑 SL:      29842.15\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 Risk: $50  |  SL dist: 12.00 pts\n` +
        `⏱ 15M · CRT Signal · ${now}\n\n` +
        `✅ If you got this, your webhook is working!`

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
