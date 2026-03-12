import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Bell, BellOff, CheckCircle, Clock, XCircle, Mail, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shiftBadge(days: number) {
  const cls = days > 0 ? 'bg-orange-100 text-orange-700' : days < 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';
  const label = days > 0 ? `+${days} dní` : days < 0 ? `${days} dní` : '0 dní';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

export default function Notifikace() {
  const {
    projects, notificationSettings, notificationRecords,
    updateNotificationSettings, syncConfirmations,
  } = useAppStore();

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Global notification toggle (projectId = '*')
  const globalSetting = notificationSettings.find(s => s.projectId === '*');
  const globalEnabled = globalSetting?.enabled ?? true;

  function isEnabled(projectId: string): boolean {
    const perProject = notificationSettings.find(s => s.projectId === projectId);
    if (perProject !== undefined) return perProject.enabled;
    return globalEnabled;
  }

  function toggleProject(projectId: string) {
    updateNotificationSettings(projectId, !isEnabled(projectId));
  }

  function toggleGlobal() {
    updateNotificationSettings('*', !globalEnabled);
  }

  // Sync confirmation statuses from Neon
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

  const sentCount = notificationRecords.filter(r => r.status === 'sent').length;
  const confirmedCount = notificationRecords.filter(r => r.status === 'confirmed').length;
  const errorCount = notificationRecords.filter(r => r.status === 'error').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <Bell size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifikace</h1>
          <p className="text-sm text-gray-500">Automatické emaily zhotovitelům při posunu termínů</p>
        </div>
      </div>

      {/* Stats row */}
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

      {/* Global settings card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Nastavení</h2>

        <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            {globalEnabled ? <Bell size={16} className="text-indigo-500" /> : <BellOff size={16} className="text-gray-400" />}
            <div>
              <div className="text-sm font-medium text-gray-800">Globální notifikace</div>
              <div className="text-xs text-gray-500">Platí pro všechny projekty (pokud není nastaveno jinak)</div>
            </div>
          </div>
          <button
            onClick={toggleGlobal}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              globalEnabled ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                globalEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Per-project toggles */}
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Jednotlivé projekty</p>
          {projects.map(p => {
            const enabled = isEnabled(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm text-gray-700">{p.name}</span>
                </div>
                <button
                  onClick={() => toggleProject(p.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    enabled ? 'bg-indigo-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                      enabled ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <strong>Jak to funguje:</strong> Když změníte datum úkolu a dojde k automatickému posunu navazujících úkolů,
          systém automaticky odešle email zhotoviteli s novým termínem.
          Zhotovitel klikne na tlačítko „Potvrzuji termín" a ve vaší aplikaci se u úkolu zobrazí <strong>Odsouhlaseno</strong>.
        </div>
      </div>

      {/* Notification history */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Historie notifikací</h2>
          <div className="flex items-center gap-2">
            {syncMsg && (
              <span className="text-xs text-gray-500 italic">{syncMsg}</span>
            )}
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
            <p className="text-xs mt-1 text-gray-400">Notifikace se odešlou automaticky při posunu termínů</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notificationRecords.map(record => {
              const isExpanded = expandedRecord === record.id;
              return (
                <div key={record.id} className="px-5 py-3">
                  <button
                    onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    {/* Status icon */}
                    {record.status === 'confirmed' ? (
                      <CheckCircle size={16} className="text-green-500 shrink-0" />
                    ) : record.status === 'error' ? (
                      <XCircle size={16} className="text-red-400 shrink-0" />
                    ) : (
                      <Clock size={16} className="text-orange-400 shrink-0" />
                    )}

                    {/* Task name */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{record.taskName}</div>
                      <div className="text-xs text-gray-500 truncate">{record.contractorName} · {record.contractorEmail}</div>
                    </div>

                    {/* Shift badge */}
                    <div className="shrink-0">{shiftBadge(record.shiftDays)}</div>

                    {/* New start */}
                    <div className="text-xs text-gray-500 shrink-0 w-24 text-right">{formatDate(record.newStart)}</div>

                    {/* Status label */}
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
                    <div className="mt-3 ml-7 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-400">Původní nástup:</span>
                        <span className="ml-1 font-medium text-gray-700">{formatDate(record.oldStart)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Nový nástup:</span>
                        <span className="ml-1 font-medium text-green-700">{formatDate(record.newStart)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Odesláno:</span>
                        <span className="ml-1 font-medium">{formatDateTime(record.sentAt)}</span>
                      </div>
                      {record.confirmedAt && (
                        <div>
                          <span className="text-gray-400">Potvrzeno:</span>
                          <span className="ml-1 font-medium text-green-700">{formatDateTime(record.confirmedAt)}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-gray-400">Token:</span>
                        <span className="ml-1 font-mono text-gray-400 text-[10px]">{record.token}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-400 pb-4">
        <div className="flex items-center gap-1.5"><Clock size={12} className="text-orange-400" /> Čeká na potvrzení</div>
        <div className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> Odsouhlaseno</div>
        <div className="flex items-center gap-1.5"><XCircle size={12} className="text-red-400" /> Chyba odeslání</div>
        <div className="flex items-center gap-1.5"><Trash2 size={12} /> Celkový počet: {notificationRecords.length}</div>
      </div>
    </div>
  );
}
