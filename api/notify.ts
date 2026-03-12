import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shiftLabel(days: number): string {
  if (days > 0) return `o ${days} dní dopředu`;
  if (days < 0) return `o ${Math.abs(days)} dní dozadu`;
  return 'beze změny';
}

export interface NotifyPayload {
  notifications: Array<{
    taskId: string;
    taskName: string;
    projectId: string;
    projectName: string;
    contractorId: string;
    contractorName: string;
    contractorEmail: string;
    oldStart: string;
    newStart: string;
    oldEnd: string;
    newEnd: string;
    shiftDays: number;
  }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const payload = req.body as NotifyPayload;

  if (!payload?.notifications?.length) {
    return res.status(400).json({ error: 'Missing notifications array' });
  }

  const results: Array<{ taskId: string; token: string; success: boolean; error?: string }> = [];

  for (const n of payload.notifications) {
    const token = crypto.randomUUID();
    const confirmUrl = `${req.headers.origin || 'https://harmonogram-delta.vercel.app'}/api/confirm?token=${token}`;

    const htmlBody = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Změna termínu – ${n.taskName}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: #1e40af; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 28px 32px; }
    .greeting { font-size: 16px; color: #111827; margin-bottom: 16px; }
    .task-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .task-box .task-name { font-weight: 700; font-size: 17px; color: #1e40af; margin-bottom: 12px; }
    .date-row { display: flex; gap: 20px; flex-wrap: wrap; }
    .date-block { flex: 1; min-width: 130px; }
    .date-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4px; }
    .date-value { font-size: 15px; font-weight: 600; }
    .old-date { color: #6b7280; text-decoration: line-through; }
    .new-date { color: #059669; }
    .shift-badge { display: inline-block; margin-top: 12px; background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .cta { text-align: center; margin: 28px 0 12px; }
    .cta a { display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; }
    .cta a:hover { background: #15803d; }
    .footer { padding: 16px 32px 24px; color: #9ca3af; font-size: 12px; border-top: 1px solid #f0f0f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Změna termínu zahájení</h1>
      <p>Projekt: ${n.projectName}</p>
    </div>
    <div class="body">
      <p class="greeting">Dobrý den, ${n.contractorName},</p>
      <p>z důvodu posunu předcházejících prací došlo ke změně termínu zahájení Vašeho úkolu:</p>

      <div class="task-box">
        <div class="task-name">${n.taskName}</div>
        <div class="date-row">
          <div class="date-block">
            <div class="date-label">Původní nástup</div>
            <div class="date-value old-date">${formatDate(n.oldStart)}</div>
          </div>
          <div class="date-block">
            <div class="date-label">Nový nástup</div>
            <div class="date-value new-date">${formatDate(n.newStart)}</div>
          </div>
          <div class="date-block">
            <div class="date-label">Dokončení</div>
            <div class="date-value" style="color:#374151">${formatDate(n.newEnd)}</div>
          </div>
        </div>
        <div class="shift-badge">Posun ${shiftLabel(n.shiftDays)}</div>
      </div>

      <p style="color:#374151; font-size:15px;">Prosíme o potvrzení, že nový termín berete na vědomí a je pro Vás akceptovatelný.</p>

      <div class="cta">
        <a href="${confirmUrl}">✓ Potvrzuji nový termín</a>
      </div>

      <p style="color:#9ca3af; font-size:12px; text-align:center;">
        Pokud máte dotazy, odpovězte prosím na tento email nebo kontaktujte projektového manažera.
      </p>
    </div>
    <div class="footer">
      Tato zpráva byla automaticky odeslána systémem Tesgrup Development – Plánování staveb.<br>
      Tlačítko slouží pouze k potvrzení přijetí informace, nevyžaduje přihlášení.
    </div>
  </div>
</body>
</html>`;

    try {
      // Store in DB first
      await sql`
        INSERT INTO notification_confirmations
          (token, task_id, project_id, task_name, contractor_id, contractor_name, contractor_email, old_start, new_start, shift_days)
        VALUES
          (${token}, ${n.taskId}, ${n.projectId}, ${n.taskName}, ${n.contractorId}, ${n.contractorName}, ${n.contractorEmail},
           ${n.oldStart}::date, ${n.newStart}::date, ${n.shiftDays})
      `;

      // Send email
      await transporter.sendMail({
        from: `"Tesgrup Development" <${process.env.GMAIL_USER}>`,
        to: n.contractorEmail,
        subject: `Změna termínu: ${n.taskName} (${formatDate(n.newStart)})`,
        html: htmlBody,
      });

      results.push({ taskId: n.taskId, token, success: true });
    } catch (err) {
      console.error('Notification error for task', n.taskId, err);
      results.push({ taskId: n.taskId, token, success: false, error: String(err) });
    }
  }

  return res.status(200).json({ results });
}
