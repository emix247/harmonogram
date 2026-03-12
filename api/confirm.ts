import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).send(errorPage('Neplatný odkaz', 'Token chybí nebo je neplatný.'));
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const rows = await sql`
      SELECT token, task_name, contractor_name, new_start, confirmed_at
      FROM notification_confirmations
      WHERE token = ${token}
    `;

    if (rows.length === 0) {
      return res.status(404).send(errorPage('Odkaz nenalezen', 'Tento potvrzovací odkaz neexistuje nebo vypršel.'));
    }

    const row = rows[0];

    if (row.confirmed_at) {
      return res.status(200).send(successPage(
        row.task_name as string,
        row.new_start as string,
        row.contractor_name as string,
        true,
        new Date(row.confirmed_at as string).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      ));
    }

    // Mark as confirmed
    await sql`
      UPDATE notification_confirmations
      SET confirmed_at = NOW()
      WHERE token = ${token}
    `;

    return res.status(200).send(successPage(
      row.task_name as string,
      row.new_start as string,
      row.contractor_name as string,
      false,
      ''
    ));
  } catch (err) {
    console.error('Confirm error:', err);
    return res.status(500).send(errorPage('Chyba serveru', 'Nastala technická chyba. Zkuste to prosím znovu.'));
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function successPage(taskName: string, newStart: string, contractorName: string, alreadyConfirmed: boolean, confirmedAtStr: string): string {
  const alreadyMsg = alreadyConfirmed
    ? `<p style="color:#6b7280;font-size:14px;">Termín jste již potvrdil/a dne ${confirmedAtStr}.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termín potvrzen</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0fdf4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); padding: 40px 36px; max-width: 440px; width: 100%; text-align: center; }
    .icon { width: 72px; height: 72px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; }
    h1 { font-size: 22px; color: #15803d; margin-bottom: 10px; }
    .task { font-size: 17px; font-weight: 700; color: #111827; margin: 16px 0 4px; }
    .date { font-size: 15px; color: #374151; margin-bottom: 16px; }
    .badge { display: inline-block; background: #dcfce7; color: #15803d; border-radius: 20px; padding: 6px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
    p { color: #6b7280; font-size: 14px; line-height: 1.6; }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #f0f0f0; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>${alreadyConfirmed ? 'Již potvrzeno' : 'Termín potvrzen!'}</h1>
    <p>Dobrý den, ${contractorName},</p>
    <div class="task">${taskName}</div>
    <div class="date">Nástup: ${formatDate(newStart)}</div>
    <div class="badge">✓ Odsouhlaseno</div>
    ${alreadyMsg}
    <p>Potvrzení bylo zaznamenáno. Informaci jsme předali projektovému manažerovi.</p>
    <div class="footer">Tesgrup Development – Plánování staveb</div>
  </div>
</body>
</html>`;
}

function errorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fef2f2; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); padding: 40px 36px; max-width: 440px; width: 100%; text-align: center; }
    .icon { width: 72px; height: 72px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; }
    h1 { font-size: 22px; color: #dc2626; margin-bottom: 16px; }
    p { color: #6b7280; font-size: 15px; }
    .footer { margin-top: 28px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✗</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="footer">Tesgrup Development – Plánování staveb</div>
  </div>
</body>
</html>`;
}
