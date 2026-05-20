// ─── EBP Dashboard API — /api/trades-data ─────────────────────────────────────
// GET  ?pair=&account=&days=&status=   → returns filtered trade list
// PATCH { id, manually_excluded?, notes?, status? }  → manual overrides

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

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
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
  return r.json().catch(() => null)
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.' })
  }

  try {
    if (req.method === 'GET') {
      const { pair, account, days, status } = req.query
      let qs = '?order=signal_time.desc&limit=1000'
      if (pair && pair !== 'all')    qs += `&pair=eq.${encodeURIComponent(pair)}`
      if (account && account !== 'all') qs += `&account_num=eq.${+account}`
      if (status && status !== 'all')   qs += `&status=eq.${encodeURIComponent(status)}`
      if (days && +days > 0) {
        const since = new Date(Date.now() - +days * 86400000).toISOString()
        qs += `&signal_time=gte.${encodeURIComponent(since)}`
      }
      const trades = await sb('GET', `/trades${qs}`)
      return res.status(200).json({ trades: trades || [] })
    }

    if (req.method === 'PATCH') {
      const body = req.body || {}
      const { id } = body
      if (!id) return res.status(400).json({ error: 'id required' })

      const allowed = ['manually_excluded', 'notes', 'status']
      const update = {}
      for (const k of allowed) {
        if (k in body) update[k] = body[k]
      }
      if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields to update' })

      const result = await sb('PATCH', `/trades?id=eq.${+id}`, update)
      return res.status(200).json({ success: true, trade: result?.[0] })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('trades-data error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
