import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL!);

  // ── POST /api/photos — store one compressed photo ─────────────────────────
  if (req.method === 'POST') {
    const { id, data, mimeType = 'image/jpeg' } = req.body as {
      id: string; data: string; mimeType?: string;
    };
    if (!id || !data) return res.status(400).json({ error: 'Missing id or data' });

    await sql`
      INSERT INTO photos (id, data, mime_type)
      VALUES (${id}, ${data}, ${mimeType})
      ON CONFLICT (id) DO NOTHING
    `;
    return res.status(200).json({ url: `/api/photos?id=${encodeURIComponent(id)}` });
  }

  // ── GET /api/photos?id=... — serve photo ──────────────────────────────────
  if (req.method === 'GET') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const rows = await sql`SELECT data, mime_type FROM photos WHERE id = ${id}`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const { data, mime_type } = rows[0] as { data: string; mime_type: string };
    const buffer = Buffer.from(data, 'base64');
    res.setHeader('Content-Type', mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
