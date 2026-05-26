// ─── Smart Money AI Dashboard API — /api/trades-data ───────────────────────
// GET  ?ticker=&direction=&status=&days=  → filtered trade list
// PATCH { id, status?, notes? }           → manual overrides

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

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
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
  return r.json().catch(() => null)
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!SUPABASE_URL || !SUPABASE_KEY)
    return res.status(500).json({ error: 'Supabase not configured' })

  try {
    if (req.method === 'GET') {
      const { ticker, direction, status, days } = req.query
      let qs = '?order=signal_time.desc&limit=500'
      if (ticker    && ticker    !== 'all') qs += `&ticker=eq.${encodeURIComponent(ticker)}`
      if (direction && direction !== 'all') qs += `&direction=eq.${encodeURIComponent(direction)}`
      if (status    && status    !== 'all') qs += `&status=eq.${encodeURIComponent(status)}`
      if (days && +days > 0) {
        const since = new Date(Date.now() - +days * 86400000).toISOString()
        qs += `&signal_time=gte.${encodeURIComponent(since)}`
      }
      const trades = await sb('GET', `/trades${qs}`)
      return res.status(200).json({ trades: trades || [] })
    }

    if (req.method === 'PATCH') {
      const { id, status, notes } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id required' })

      const VALID_STATUS = ['TRIGGERED','FILLED','BE_ACTIVE','TP2_HIT','SL_HIT','BE_EXIT','CANCELLED']
      const update = {}
      if (status !== undefined) {
        if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' })
        update.status = status
        if (status === 'FILLED')  update.fill_time    = new Date().toISOString()
        if (status === 'TP2_HIT' || status === 'SL_HIT' || status === 'BE_EXIT')
          update.outcome_time = new Date().toISOString()
        if (status === 'BE_ACTIVE') update.be_time = new Date().toISOString()
      }
      if (notes !== undefined) update.notes = notes

      if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields' })
      const result = await sb('PATCH', `/trades?id=eq.${+id}`, update)
      return res.status(200).json({ success: true, trade: result?.[0] })
    }

    if (req.method === 'DELETE') {
      if (req.query.confirm !== 'purge') {
        return res.status(400).json({ error: 'Add ?confirm=purge to delete all trades' })
      }
      await sb('DELETE', '/trades?id=gt.0')
      return res.status(200).json({ success: true, message: 'All trades deleted' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('trades-data error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
