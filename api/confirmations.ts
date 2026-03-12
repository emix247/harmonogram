import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/confirmations?tokens=token1,token2,...
 * Returns { [token]: confirmedAt | null }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawTokens = req.query.tokens;
  if (!rawTokens) {
    return res.status(400).json({ error: 'tokens query param required' });
  }

  const tokens = (Array.isArray(rawTokens) ? rawTokens.join(',') : rawTokens)
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return res.status(400).json({ error: 'No tokens provided' });
  }

  if (tokens.length > 200) {
    return res.status(400).json({ error: 'Too many tokens (max 200)' });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const rows = await sql`
      SELECT token, confirmed_at
      FROM notification_confirmations
      WHERE token = ANY(${tokens}::text[])
    `;

    const result: Record<string, string | null> = {};
    for (const token of tokens) {
      result[token] = null;
    }
    for (const row of rows) {
      result[row.token as string] = row.confirmed_at ? new Date(row.confirmed_at as string).toISOString() : null;
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Confirmations error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}
