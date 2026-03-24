import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// ── SMTP transporter (explicit host/port avoids Vercel service-name issues) ──
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shiftLabel(days: number): string {
  if (days > 0) return `o ${days} dní`;
  if (days < 0) return `o ${Math.abs(days)} dní`;
  return 'beze změny';
}

/** Replace {{variable}} placeholders */
function renderVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Payload ───────────────────────────────────────────────────────────────────

export interface NotifyItem {
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
  notificationType?: 'cascade' | 'deadline_reminder' | 'internal_reminder' | 'problem_report';
  ruleId?: string;
  // email template overrides (uses defaults if absent)
  emailSubject?: string;
  emailIntro?: string;
  emailFooter?: string;
  emailNote?: string;
  showConfirmButton?: boolean;
  ccEmails?: string[];
  internalEmails?: string[];
  photoUrls?: string[];
  // deadline_reminder / internal_reminder extra
  daysBeforeDeadline?: number;
}

export interface NotifyPayload {
  notifications: NotifyItem[];
}

// ── Default templates ─────────────────────────────────────────────────────────

const DEFAULT_SUBJECT = 'Změna termínu: {{ukolNazev}} (nástup {{novyNastup}})';
const DEFAULT_INTRO   = 'z důvodu posunu předcházejících prací došlo ke změně termínu zahájení Vašeho úkolu. Prosíme o potvrzení, že nový termín berete na vědomí a je pro Vás akceptovatelný.';
const DEFAULT_FOOTER  = 'Tato zpráva byla automaticky odeslána systémem Plánování staveb. Tlačítko slouží k potvrzení přijetí informace, nevyžaduje přihlášení.';

const DEFAULT_REMINDER_SUBJECT  = 'Připomínka: {{ukolNazev}} za {{dniDoKonce}} dní';
const DEFAULT_REMINDER_INTRO    = 'dovolujeme si Vám připomenout blížící se termín Vašeho úkolu. Ujistěte se prosím, že práce probíhají dle plánu a termín bude dodržen.';
const DEFAULT_REMINDER_FOOTER   = 'Tato zpráva byla automaticky odeslána systémem Plánování staveb.';
const DEFAULT_INTERNAL_SUBJECT  = 'Upomínka: {{ukolNazev}} (nástup {{novyNastup}})';
const DEFAULT_INTERNAL_INTRO    = 'Upomínka úkolu: {{ukolNazev}} začíná {{datumZahajeni}} - je potřeba zajistit materiál.';
const DEFAULT_INTERNAL_FOOTER   = 'Tato zpráva byla automaticky odeslána systémem Plánování staveb.';
const DEFAULT_INTERNAL_NOTE     = 'Beru na vědomí, mám zajištěno, nebo zajistím.';

const DEFAULT_PROBLEM_SUBJECT = 'Hlášení problému: {{ukolNazev}} — projekt {{projektNazev}}';
const DEFAULT_PROBLEM_FOOTER  = 'Tato zpráva byla odeslána stavbyvedoucím přes systém Plánování staveb. Prosíme o neprodlené vyjádření.';

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmail(n: NotifyItem, confirmUrl: string): { subject: string; html: string } {
  const isReminder  = n.notificationType === 'deadline_reminder';
  const isInternal  = n.notificationType === 'internal_reminder';
  const isProblem   = n.notificationType === 'problem_report';
  const dniDo       = n.daysBeforeDeadline != null ? String(n.daysBeforeDeadline) : '—';

  const vars: Record<string, string> = {
    zhotovitel:          n.contractorName,
    ukolNazev:           n.taskName,
    projektNazev:        n.projectName,
    starePozadanaNastup: formatDate(n.oldStart),
    novyNastup:          formatDate(n.newStart),
    novyKonec:           formatDate(n.newEnd),
    posun:               shiftLabel(n.shiftDays),
    datumKonce:          formatDate(n.newEnd),
    datumZahajeni:       formatDate(n.newStart),
    datumDokonceni:      formatDate(n.newEnd),
    dniDoKonce:          dniDo,
    dniDo:               dniDo,
  };

  const defaultSubject = isProblem   ? DEFAULT_PROBLEM_SUBJECT
    : isInternal ? DEFAULT_INTERNAL_SUBJECT
    : isReminder ? DEFAULT_REMINDER_SUBJECT : DEFAULT_SUBJECT;
  const defaultIntro   = isInternal ? DEFAULT_INTERNAL_INTRO
    : isReminder ? DEFAULT_REMINDER_INTRO : DEFAULT_INTRO;
  const defaultFooter  = isProblem   ? DEFAULT_PROBLEM_FOOTER
    : isInternal ? DEFAULT_INTERNAL_FOOTER
    : isReminder ? DEFAULT_REMINDER_FOOTER : DEFAULT_FOOTER;

  const subject     = renderVars(n.emailSubject ?? defaultSubject, vars);
  const intro       = renderVars(n.emailIntro   ?? defaultIntro,   vars);
  const footer      = renderVars(n.emailFooter  ?? defaultFooter,  vars);
  const showConfirm = n.showConfirmButton ?? false;

  // ── Date table ────────────────────────────────────────────────────────────
  const dateTableHtml = isInternal ? `
    <div class="task-box">
      <div class="task-name">${n.taskName}</div>
      <div class="date-row">
        <div class="date-block">
          <div class="date-label">Datum zahájení</div>
          <div class="date-value new-date">${formatDate(n.newStart)}</div>
        </div>
        <div class="date-block">
          <div class="date-label">Datum dokončení</div>
          <div class="date-value" style="color:#374151">${formatDate(n.newEnd)}</div>
        </div>
        <div class="date-block">
          <div class="date-label">Zbývá dní</div>
          <div class="date-value" style="color:#b45309">${dniDo}</div>
        </div>
      </div>
    </div>`
  : isReminder ? `
    <div class="task-box">
      <div class="task-name">${n.taskName}</div>
      <div class="date-row">
        <div class="date-block">
          <div class="date-label">Termín dokončení</div>
          <div class="date-value new-date">${formatDate(n.newEnd)}</div>
        </div>
        <div class="date-block">
          <div class="date-label">Zbývá dní</div>
          <div class="date-value" style="color:#b45309">${dniDo}</div>
        </div>
      </div>
    </div>` : `
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
    </div>`;

  const confirmBtnHtml = showConfirm ? `
    <div class="cta">
      <a href="${confirmUrl}">✓ Potvrzuji nový termín</a>
    </div>` : '';

  // ── problem_report: simple description block ──────────────────────────────
  const photosHtml = (n.photoUrls?.length)
    ? `<div style="margin-top:16px;">
        <div class="date-label" style="margin-bottom:8px;">Přiložené fotografie (${n.photoUrls.length})</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${n.photoUrls.map(url =>
            `<a href="${url}" target="_blank" style="display:block; border-radius:6px; overflow:hidden; border:1px solid #e2e8f0;">
              <img src="${url}" alt="foto" style="width:160px; height:120px; object-fit:cover; display:block;" />
            </a>`
          ).join('')}
        </div>
      </div>` : '';

  const problemBlockHtml = isProblem ? `
    <div class="task-box" style="border-left:4px solid #dc2626;">
      <div class="task-name" style="color:#dc2626;">⚠ ${n.taskName}</div>
      <p style="margin:8px 0 0; color:#374151; font-size:15px;">${intro}</p>
      <div style="margin-top:14px; display:flex; gap:20px; flex-wrap:wrap;">
        <div><div class="date-label">Projekt</div><div class="date-value" style="color:#374151;">${n.projectName}</div></div>
        <div><div class="date-label">Plánovaný nástup</div><div class="date-value new-date">${formatDate(n.newStart)}</div></div>
        <div><div class="date-label">Plánované dokončení</div><div class="date-value" style="color:#374151;">${formatDate(n.newEnd)}</div></div>
      </div>
      ${photosHtml}
    </div>` : '';

  // ── Header colour ──────────────────────────────────────────────────────────
  const headerBg = isProblem ? '#dc2626' : isInternal ? '#b45309' : '#1e40af';
  const headerTitle = isProblem ? '⚠ Hlášení problému ze staveniště'
    : isInternal ? 'Interní připomínka'
    : isReminder ? 'Připomínka termínu' : 'Změna termínu zahájení';
  const greeting = (isInternal || isProblem)
    ? `<p class="greeting">Dobrý den, ${n.contractorName || ''},</p>`
    : `<p class="greeting">Dobrý den, ${n.contractorName},</p>`;

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: ${headerBg}; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 28px 32px; }
    .greeting { font-size: 16px; color: #111827; margin-bottom: 16px; }
    .task-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .task-box .task-name { font-weight: 700; font-size: 17px; color: ${isInternal ? '#b45309' : '#1e40af'}; margin-bottom: 12px; }
    .date-row { display: flex; gap: 20px; flex-wrap: wrap; }
    .date-block { flex: 1; min-width: 130px; }
    .date-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 4px; }
    .date-value { font-size: 15px; font-weight: 600; }
    .old-date { color: #6b7280; text-decoration: line-through; }
    .new-date { color: #059669; }
    .shift-badge { display: inline-block; margin-top: 12px; background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .cta { text-align: center; margin: 28px 0 12px; }
    .cta a { display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 700; }
    .footer { padding: 16px 32px 24px; color: #9ca3af; font-size: 12px; border-top: 1px solid #f0f0f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${headerTitle}</h1>
      <p>Projekt: ${n.projectName}</p>
    </div>
    <div class="body">
      ${greeting}
      ${isProblem ? problemBlockHtml : `<p>${intro}</p>${dateTableHtml}`}
      ${confirmBtnHtml}
      ${n.emailNote ? `<p style="color:#9ca3af; font-size:12px; text-align:center;">${n.emailNote}</p>` : ''}
    </div>
    <div class="footer">${footer}</div>
  </div>
</body>
</html>`;

  return { subject, html };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sql = neon(process.env.DATABASE_URL!);
  const payload = req.body as NotifyPayload;

  if (!payload?.notifications?.length) {
    return res.status(400).json({ error: 'Missing notifications array' });
  }

  const transporter = createTransporter();
  const origin = (req.headers.origin as string | undefined) || 'https://harmonogram-delta.vercel.app';

  const results: Array<{ taskId: string; token: string; success: boolean; error?: string }> = [];

  for (const n of payload.notifications) {
    const token = crypto.randomUUID();
    const confirmUrl = `${origin}/api/confirm?token=${token}`;

    try {
      // 1. Store in DB
      await sql`
        INSERT INTO notification_confirmations
          (token, task_id, project_id, task_name, contractor_id, contractor_name, contractor_email,
           old_start, new_start, shift_days)
        VALUES
          (${token}, ${n.taskId}, ${n.projectId}, ${n.taskName}, ${n.contractorId},
           ${n.contractorName}, ${n.contractorEmail},
           ${n.oldStart}::date, ${n.newStart}::date, ${n.shiftDays})
      `;

      // 2. Build email
      const { subject, html } = buildEmail(n, confirmUrl);

      // 3. Send — internal_reminder goes to internalEmails, others to contractorEmail
      const toAddr = n.notificationType === 'internal_reminder'
        ? (n.internalEmails?.join(',') ?? n.contractorEmail)
        : n.contractorEmail;
      await transporter.sendMail({
        from: `"Tesgrup Development" <${process.env.GMAIL_USER}>`,
        to: toAddr,
        cc: n.ccEmails?.length ? n.ccEmails.join(',') : undefined,
        subject,
        html,
      });

      results.push({ taskId: n.taskId, token, success: true });
    } catch (err) {
      console.error('Notification error for task', n.taskId, err);
      results.push({ taskId: n.taskId, token, success: false, error: String(err) });
    }
  }

  return res.status(200).json({ results });
}
