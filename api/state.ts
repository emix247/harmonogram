import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const STATE_KEY = 'main';
const MAX_HISTORY = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL!);

  // ── GET: return stored state (or snapshot history) ────────────────────────
  if (req.method === 'GET') {
    // ?history=true  →  return last N snapshots (id + saved_at, no state blob)
    if (req.query.history === 'true') {
      try {
        const rows = await sql`
          SELECT id, saved_at
          FROM app_state_history
          ORDER BY saved_at DESC
          LIMIT ${MAX_HISTORY}
        `;
        return res.status(200).json({ snapshots: rows });
      } catch (err) {
        console.error('GET /api/state?history error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
    }

    // ?snapshot=<id>  →  return full state for that snapshot
    if (req.query.snapshot) {
      try {
        const rows = await sql`
          SELECT state, saved_at FROM app_state_history WHERE id = ${Number(req.query.snapshot)}
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Snapshot not found' });
        return res.status(200).json({ state: rows[0].state, savedAt: rows[0].saved_at });
      } catch (err) {
        console.error('GET /api/state?snapshot error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
    }

    // default: current state
    try {
      const rows = await sql`
        SELECT state, updated_at FROM app_state WHERE key = ${STATE_KEY}
      `;
      if (rows.length === 0) return res.status(200).json({ state: null, updatedAt: null });
      return res.status(200).json({ state: rows[0].state, updatedAt: rows[0].updated_at });
    } catch (err) {
      console.error('GET /api/state error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  // ── POST: upsert state ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { state, clientUpdatedAt } = req.body ?? {};
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Missing state object' });
    }

    try {
      // 1. Read current state from Neon
      const current = await sql`
        SELECT state, updated_at FROM app_state WHERE key = ${STATE_KEY}
      `;

      if (current.length > 0) {
        // 2. Stale-write guard: if Neon is newer than what the client loaded, reject
        if (clientUpdatedAt) {
          const neonTs  = new Date(current[0].updated_at).getTime();
          const clientTs = new Date(clientUpdatedAt).getTime();
          if (neonTs > clientTs + 2000) {           // 2 s tolerance for clock skew
            return res.status(409).json({
              error: 'conflict',
              serverUpdatedAt: current[0].updated_at,
              message: 'Server has newer data — reload first',
            });
          }
        }

        // 3. Copy current state to history before overwriting
        await sql`
          INSERT INTO app_state_history (state, saved_at)
          VALUES (${JSON.stringify(current[0].state)}::jsonb, ${current[0].updated_at})
        `;

        // 4. Trim history to MAX_HISTORY entries
        await sql`
          DELETE FROM app_state_history
          WHERE id NOT IN (
            SELECT id FROM app_state_history ORDER BY saved_at DESC LIMIT ${MAX_HISTORY}
          )
        `;
      }

      // 5. Write new state
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
