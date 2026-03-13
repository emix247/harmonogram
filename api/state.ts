import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const STATE_KEY = 'main';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS for same-origin calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = neon(process.env.DATABASE_URL!);

  // ── GET: return stored state ──────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT state, updated_at FROM app_state WHERE key = ${STATE_KEY}
      `;
      if (rows.length === 0) {
        return res.status(200).json({ state: null, updatedAt: null });
      }
      return res.status(200).json({
        state: rows[0].state,
        updatedAt: rows[0].updated_at,
      });
    } catch (err) {
      console.error('GET /api/state error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  // ── POST: upsert state ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { state } = req.body ?? {};
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Missing state object' });
    }

    try {
      const rows = await sql`
        INSERT INTO app_state (key, state, updated_at)
        VALUES (${STATE_KEY}, ${JSON.stringify(state)}::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE
          SET state = EXCLUDED.state,
              updated_at = NOW()
        RETURNING updated_at
      `;
      return res.status(200).json({ ok: true, updatedAt: rows[0].updated_at });
    } catch (err) {
      console.error('POST /api/state error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
