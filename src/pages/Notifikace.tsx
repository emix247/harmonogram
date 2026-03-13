import { useState } from 'react';
import { useAppStore, defaultNotificationRules } from '../store/appStore';
import type { NotificationRule } from '../types';
import {
  Bell, CheckCircle, Clock, XCircle, Mail, RefreshCw,
  ChevronDown, ChevronUp, Plus, Trash2, Settings2,
  Zap, CalendarClock, Copy,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shiftBadge(days: number) {
  if (days === 0) return null;
  const cls = days > 0 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';
  const label = days > 0 ? `+${days} dní` : `${days} dní`;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

// ── Variables reference ───────────────────────────────────────────────────────

const CASCADE_VARS = [
  { key: '{{zhotovitel}}', desc: 'Jméno zhotovitele' },
  { key: '{{ukolNazev}}', desc: 'Název úkolu' },
  { key: '{{projektNazev}}', desc: 'Název projektu' },
  { key: '{{starePozadanaNastup}}', desc: 'Původní datum nástupu' },
  { key: '{{novyNastup}}', desc: 'Nové datum nástupu' },
  { key: '{{novyKonec}}', desc: 'Nové datum dokončení' },
  { key: '{{posun}}', desc: 'Popis posunu (např. o 7 dní dopředu)' },
];

const REMINDER_VARS = [
  { key: '{{zhotovitel}}', desc: 'Jméno zhotovitele' },
  { key: '{{ukolNazev}}', desc: 'Název úkolu' },
  { key: '{{projektNazev}}', desc: 'Název projektu' },
  { key: '{{datumKonce}}', desc: 'Datum konce úkolu' },
  { key: '{{dniDoKonce}}', desc: 'Počet dní do konce' },
];

function VarsChips({ trigger }: { trigger: 'cascade' | 'deadline_reminder' }) {
  const vars = trigger === 'cascade' ? CASCADE_VARS : REMINDER_VARS;
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dostupné proměnné</p>
      <div className="flex flex-wrap gap-1.5">
        {vars.map(v => (
          <button
            key={v.key}
            title={`Zkopírovat: ${v.desc}`}
            className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded text-xs font-mono text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
            onClick={() => navigator.clipboard?.writeText(v.key)}
          >
            <Copy size={10} className="text-gray-400" />
            {v.key}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">Klikněte na proměnnou pro zkopírování do schránky</p>
    </div>
  );
}

// ── Rule editor (inline expandable) ──────────────────────────────────────────

interface RuleEditorProps {
  rule: NotificationRule;
  projectOptions: { id: string; name: string; color: string }[];
  onChange: (updates: Partial<NotificationRule>) => void;
  onDelete: () => void;
}

function RuleEditor({ rule, projectOptions, onChange, onDelete }: RuleEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const TriggerIcon = rule.trigger === 'cascade' ? Zap : CalendarClock;

  return (
    <div className={`border rounded-xl transition-all ${rule.enabled ? 'border-gray-200' : 'border-gray-100 bg-gray-50/50'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle */}
        <button
          onClick={() => onChange({ enabled: !rule.enabled })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${rule.enabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>

        {/* Icon + name */}
        <TriggerIcon size={14} className={rule.enabled ? 'text-indigo-500' : 'text-gray-400'} />
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${rule.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{rule.name}</span>
          <span className="ml-2 text-xs text-gray-400">
            {rule.trigger === 'cascade'
              ? `posun ≥ ${rule.minShiftDays} ${rule.minShiftDays === 1 ? 'den' : 'dní'}`
              : `${rule.daysBeforeDeadline} dní před termínem`}
            {rule.projectIds.length > 0 && ` · ${rule.projectIds.length} projekt${rule.projectIds.length > 1 ? 'y' : ''}`}
          </span>
        </div>

        {/* Actions */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Upravit pravidlo"
        >
          <Settings2 size={14} />
        </button>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Název pravidla</label>
            <input
              type="text"
              value={rule.name}
              onChange={e => onChange({ name: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Trigger type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Typ spuštění</label>
            <div className="flex gap-2">
              {(['cascade', 'deadline_reminder'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onChange({ trigger: t })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    rule.trigger === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
                  }`}
                >
                  {t === 'cascade' ? <Zap size={12} /> : <CalendarClock size={12} />}
                  {t === 'cascade' ? 'Posun kaskádou' : 'Připomínka termínu'}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger config */}
          <div className="grid grid-cols-2 gap-3">
            {rule.trigger === 'cascade' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Min. posun (dní)</label>
                <input
                  type="number" min={1} max={365}
                  value={rule.minShiftDays}
                  onChange={e => onChange({ minShiftDays: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">Posílat jen při posunu o ≥ N dní</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dní před termínem</label>
                <input
                  type="number" min={1} max={90}
                  value={rule.daysBeforeDeadline}
                  onChange={e => onChange({ daysBeforeDeadline: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">Poslat N dní před koncem úkolu</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">CC emaily</label>
              <input
                type="text"
                value={rule.ccEmails.join(', ')}
                onChange={e => onChange({ ccEmails: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="email1@firma.cz, email2@firma.cz"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Project filter */}
          {projectOptions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Projekty (prázdné = všechny)</label>
              <div className="flex flex-wrap gap-1.5">
                {projectOptions.map(p => {
                  const selected = rule.projectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onChange({
                        projectIds: selected
                          ? rule.projectIds.filter(id => id !== p.id)
                          : [...rule.projectIds, p.id],
                      })}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                      style={selected ? { backgroundColor: p.color, borderColor: p.color } : {}}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Email subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Předmět emailu</label>
            <input
              type="text"
              value={rule.emailSubject}
              onChange={e => onChange({ emailSubject: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
            />
          </div>

          {/* Email intro */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Úvodní text emailu</label>
            <textarea
              value={rule.emailIntro}
              onChange={e => onChange({ emailIntro: e.target.value })}
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />
          </div>

          {/* Email footer */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Patička emailu</label>
            <textarea
              value={rule.emailFooter}
              onChange={e => onChange({ emailFooter: e.target.value })}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />
          </div>

          {/* Show confirm button */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.showConfirmButton}
              onChange={e => onChange({ showConfirmButton: e.target.checked })}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-sm text-gray-700">Přidat tlačítko „Potvrzuji termín" do emailu</span>
          </label>

          {/* Variables reference */}
          <VarsChips trigger={rule.trigger} />

          {/* Delete */}
          <div className="pt-2 border-t border-gray-100 flex justify-end">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Opravdu smazat?</span>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Zrušit</button>
                <button onClick={onDelete} className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700">Smazat</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> Smazat pravidlo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Notifikace() {
  const {
    projects, notificationRules, notificationRecords,
    addNotificationRule, updateNotificationRule, deleteNotificationRule,
    syncConfirmations,
  } = useAppStore();

  const rules = notificationRules ?? defaultNotificationRules;

  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const projectOptions = projects.map(p => ({ id: p.id, name: p.name, color: p.color }));

  // ── Stats ──────────────────────────────────────────────────────────────────
  const sentCount = notificationRecords.filter(r => r.status === 'sent').length;
  const confirmedCount = notificationRecords.filter(r => r.status === 'confirmed').length;
  const errorCount = notificationRecords.filter(r => r.status === 'error').length;

  // ── Add new rule ───────────────────────────────────────────────────────────
  function handleAddRule() {
    const newRule: NotificationRule = {
      id: crypto.randomUUID(),
      name: 'Nové pravidlo',
      enabled: false,
      trigger: 'cascade',
      minShiftDays: 1,
      daysBeforeDeadline: 3,
      projectIds: [],
      emailSubject: 'Změna termínu: {{ukolNazev}} (nástup {{novyNastup}})',
      emailIntro: 'z důvodu posunu předcházejících prací došlo ke změně termínu zahájení Vašeho úkolu. Prosíme o potvrzení, že nový termín berete na vědomí.',
      emailFooter: 'Tato zpráva byla automaticky odeslána systémem Plánování staveb.',
      showConfirmButton: true,
      ccEmails: [],
    };
    addNotificationRule(newRule);
  }

  // ── Sync confirmations ────────────────────────────────────────────────────
  async function handleSync() {
    const sentRecords = notificationRecords.filter(r => r.status === 'sent');
    if (sentRecords.length === 0) {
      setSyncMsg('Žádné čekající notifikace k synchronizaci.');
      setTimeout(() => setSyncMsg(null), 3000);
      return;
    }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const tokens = sentRecords.map(r => r.token).join(',');
      const res = await fetch(`${API_BASE}/api/confirmations?tokens=${encodeURIComponent(tokens)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Record<string, string | null> = await res.json();
      const confirmed: Record<string, string> = {};
      for (const [token, at] of Object.entries(data)) {
        if (at) confirmed[token] = at;
      }
      syncConfirmations(confirmed);
      const count = Object.keys(confirmed).length;
      setSyncMsg(count > 0 ? `Synchronizováno: ${count} potvrzení.` : 'Žádná nová potvrzení.');
    } catch (e) {
      setSyncMsg('Chyba při synchronizaci: ' + String(e));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Bell size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notifikace</h1>
            <p className="text-sm text-gray-500">Automatické emaily zhotovitelům při posunu termínů</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{sentCount}</div>
          <div className="text-xs text-gray-500 mt-1">Čeká na potvrzení</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
          <div className="text-xs text-gray-500 mt-1">Potvrzeno</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-400">{notificationRecords.length}</div>
          <div className="text-xs text-gray-500 mt-1">Celkem odesláno</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'rules', label: 'Pravidla notifikací', icon: Settings2 },
          { key: 'history', label: 'Historie', icon: Mail },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
            {key === 'history' && errorCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none font-semibold">{errorCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── RULES TAB ── */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>Jak to funguje:</strong> Každé pravidlo definuje podmínku pro odeslání emailu a šablonu zprávy.
            Proměnné jako <code className="bg-blue-100 px-1 rounded">{'{{ukolNazev}}'}</code> se automaticky nahradí skutečnými hodnotami.
          </div>

          {rules.map(rule => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              projectOptions={projectOptions}
              onChange={updates => updateNotificationRule(rule.id, updates)}
              onDelete={() => deleteNotificationRule(rule.id)}
            />
          ))}

          <button
            onClick={handleAddRule}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
          >
            <Plus size={16} /> Přidat nové pravidlo
          </button>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Historie odeslaných notifikací</h2>
            <div className="flex items-center gap-2">
              {syncMsg && <span className="text-xs text-gray-500 italic">{syncMsg}</span>}
              {errorCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{errorCount} chyb</span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                Synchronizovat
              </button>
            </div>
          </div>

          {notificationRecords.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Mail size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Zatím nebyly odeslány žádné notifikace</p>
              <p className="text-xs mt-1">Notifikace se odešlou automaticky dle pravidel</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notificationRecords.map(record => {
                const isExpanded = expandedRecord === record.id;
                // Find rule name
                const rule = rules.find(r => r.id === record.ruleId);
                return (
                  <div key={record.id} className="px-5 py-3">
                    <button
                      onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      {record.status === 'confirmed' ? (
                        <CheckCircle size={16} className="text-green-500 shrink-0" />
                      ) : record.status === 'error' ? (
                        <XCircle size={16} className="text-red-400 shrink-0" />
                      ) : (
                        <Clock size={16} className="text-orange-400 shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{record.taskName}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {record.contractorName} · {record.contractorEmail}
                          {rule && <span className="ml-2 text-indigo-400">· {rule.name}</span>}
                        </div>
                      </div>

                      <div className="shrink-0">{shiftBadge(record.shiftDays)}</div>

                      <div className="text-xs text-gray-500 shrink-0 w-24 text-right">{formatDate(record.newStart)}</div>

                      <div className={`text-xs font-semibold shrink-0 w-24 text-right ${
                        record.status === 'confirmed' ? 'text-green-600' :
                        record.status === 'error' ? 'text-red-500' : 'text-orange-500'
                      }`}>
                        {record.status === 'confirmed' ? 'Odsouhlaseno' :
                         record.status === 'error' ? 'Chyba' : 'Čeká'}
                      </div>

                      <div className="shrink-0 text-gray-300">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 ml-7 space-y-2">
                        <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 grid grid-cols-2 gap-2">
                          <div><span className="text-gray-400">Původní nástup:</span><span className="ml-1 font-medium">{formatDate(record.oldStart)}</span></div>
                          <div><span className="text-gray-400">Nový nástup:</span><span className="ml-1 font-medium text-green-700">{formatDate(record.newStart)}</span></div>
                          <div><span className="text-gray-400">Odesláno:</span><span className="ml-1 font-medium">{formatDateTime(record.sentAt)}</span></div>
                          {record.confirmedAt && (
                            <div><span className="text-gray-400">Potvrzeno:</span><span className="ml-1 font-medium text-green-700">{formatDateTime(record.confirmedAt)}</span></div>
                          )}
                          {record.notificationType && (
                            <div className="col-span-2"><span className="text-gray-400">Typ:</span><span className="ml-1">{record.notificationType === 'cascade' ? 'Kaskádový posun' : 'Připomínka termínu'}</span></div>
                          )}
                          <div className="col-span-2"><span className="text-gray-400">Token:</span><span className="ml-1 font-mono text-gray-400 text-[10px] break-all">{record.token}</span></div>
                        </div>
                        {record.status === 'error' && record.errorMessage && (
                          <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                            <p className="text-xs font-semibold text-red-700 mb-1">Chyba odeslání</p>
                            <p className="text-xs text-red-600 font-mono break-all">{record.errorMessage}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-50 flex items-center gap-6 text-xs text-gray-400">
            <div className="flex items-center gap-1.5"><Clock size={12} className="text-orange-400" /> Čeká na potvrzení</div>
            <div className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> Odsouhlaseno</div>
            <div className="flex items-center gap-1.5"><XCircle size={12} className="text-red-400" /> Chyba odeslání</div>
            <div className="ml-auto">Celkem: {notificationRecords.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}
