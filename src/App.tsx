import { useState, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Login from './pages/Login';
import { useAppStore, defaultNotificationRules } from './store/appStore';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import GanttScheduler from './pages/GanttScheduler';
import Tasks from './pages/Tasks';
import Crafts from './pages/Crafts';
import Milestones from './pages/Milestones';
import Templates from './pages/Templates';
import RiskManagement from './pages/RiskManagement';
import Reports from './pages/Reports';
import MobileReporting from './pages/MobileReporting';
import Cashflow from './pages/Cashflow';
import HistoryLog from './pages/HistoryLog';
import Settings from './pages/Settings';
import PublicView from './pages/PublicView';
import Notifikace from './pages/Notifikace';
import type { NotificationRecord, PendingNotification } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const pages: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  projects: Projects,
  gantt: GanttScheduler,
  tasks: Tasks,
  crafts: Crafts,
  milestones: Milestones,
  templates: Templates,
  risks: RiskManagement,
  reports: Reports,
  mobile: MobileReporting,
  cashflow: Cashflow,
  history: HistoryLog,
  settings: Settings,
  notifications: Notifikace,
};

// ── Helper ────────────────────────────────────────────────────────────────────
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Watches `pendingNotifications`, calls /api/notify for each,
 * stores results as NotificationRecord entries, then clears the queue.
 */
function NotificationProcessor() {
  const {
    pendingNotifications, clearPendingNotifications,
    tasks, crafts, contractors, projects,
    notificationRules,
    addNotificationRecord,
  } = useAppStore();

  useEffect(() => {
    if (pendingNotifications.length === 0) return;

    const rules = notificationRules ?? defaultNotificationRules;

    const notifications: Array<{
      taskId: string; taskName: string; projectId: string; projectName: string;
      contractorId: string; contractorName: string; contractorEmail: string;
      oldStart: string; newStart: string; oldEnd: string; newEnd: string; shiftDays: number;
      notificationType: 'cascade' | 'deadline_reminder';
      ruleId?: string;
      emailSubject?: string; emailIntro?: string; emailFooter?: string;
      showConfirmButton?: boolean; ccEmails?: string[];
      daysBeforeDeadline?: number;
    }> = [];

    for (const pending of pendingNotifications) {
      const task = tasks.find(t => t.id === pending.taskId);
      if (!task) continue;

      const rule = pending.ruleId ? rules.find(r => r.id === pending.ruleId) : undefined;

      const craft = crafts.find(c => c.id === task.craftId);
      const contractorId = task.contractorId || craft?.contractorId || '';
      const contractor = contractors.find(c => c.id === contractorId);
      if (!contractor?.email) continue;

      const project = projects.find(p => p.id === task.projectId);

      notifications.push({
        taskId: task.id,
        taskName: task.name,
        projectId: task.projectId,
        projectName: project?.name ?? task.projectId,
        contractorId,
        contractorName: contractor.name,
        contractorEmail: contractor.email,
        oldStart: pending.oldStart,
        newStart: pending.newStart,
        oldEnd: pending.oldEnd,
        newEnd: pending.newEnd,
        shiftDays: pending.shiftDays,
        notificationType: pending.notificationType ?? 'cascade',
        ruleId: pending.ruleId,
        emailSubject: rule?.emailSubject,
        emailIntro: rule?.emailIntro,
        emailFooter: rule?.emailFooter,
        emailNote: rule?.emailNote,
        showConfirmButton: rule?.showConfirmButton,
        ccEmails: rule?.ccEmails,
        daysBeforeDeadline: pending.notificationType === 'deadline_reminder'
          ? rule?.daysBeforeDeadline
          : undefined,
      });
    }

    // Clear pending immediately to avoid re-processing
    clearPendingNotifications();

    if (notifications.length === 0) return;

    fetch(`${API_BASE}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications }),
    })
      .then(r => r.json())
      .then((data: { results: Array<{ taskId: string; token: string; success: boolean; error?: string }> }) => {
        const now = new Date().toISOString();
        for (const result of data.results) {
          const n = notifications.find(n => n.taskId === result.taskId);
          if (!n) continue;
          const record: NotificationRecord = {
            id: crypto.randomUUID(),
            taskId: n.taskId,
            projectId: n.projectId,
            taskName: n.taskName,
            contractorId: n.contractorId,
            contractorName: n.contractorName,
            contractorEmail: n.contractorEmail,
            oldStart: n.oldStart,
            newStart: n.newStart,
            oldEnd: n.oldEnd,
            newEnd: n.newEnd,
            shiftDays: n.shiftDays,
            token: result.token,
            sentAt: now,
            status: result.success ? 'sent' : 'error',
            ruleId: n.ruleId,
            notificationType: n.notificationType,
            errorMessage: result.success ? undefined : result.error,
          };
          addNotificationRecord(record);
        }
      })
      .catch(err => {
        console.error('Failed to send notifications:', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNotifications]);

  return null;
}

/**
 * On app load, checks deadline reminder rules and queues notifications
 * for tasks whose plannedEnd is rule.daysBeforeDeadline days from today.
 */
function DeadlineReminderProcessor() {
  const {
    tasks, crafts, contractors, notificationRules, notificationRecords,
    projectNotificationConfigs,
    appendPendingNotifications,
  } = useAppStore();

  useEffect(() => {
    const rules = notificationRules ?? defaultNotificationRules;
    const reminderRules = rules.filter(r => r.enabled && r.trigger === 'deadline_reminder');
    if (reminderRules.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const newPending: PendingNotification[] = [];

    for (const rule of reminderRules) {
      const targetDate = addDaysStr(today, rule.daysBeforeDeadline);

      const matchingTasks = tasks.filter(t => {
        const projectOk = rule.projectIds.length === 0 || rule.projectIds.includes(t.projectId);
        const projConfig = (projectNotificationConfigs ?? []).find(c => c.projectId === t.projectId);
        const projEnabled = !projConfig || projConfig.enabled;
        const ruleAllowedForProject =
          !projConfig ||
          projConfig.enabledRuleIds.length === 0 ||
          projConfig.enabledRuleIds.includes(rule.id);
        return t.plannedEnd === targetDate && t.status !== 'completed' && projectOk && projEnabled && ruleAllowedForProject;
      });

      for (const task of matchingTasks) {
        const alreadySent = notificationRecords.some(r =>
          r.taskId === task.id &&
          r.ruleId === rule.id &&
          r.notificationType === 'deadline_reminder' &&
          r.sentAt?.startsWith(today)
        );
        if (alreadySent) continue;

        const craft = crafts.find(c => c.id === task.craftId);
        const contractorId = task.contractorId || craft?.contractorId || '';
        const contractor = contractors.find(c => c.id === contractorId);
        if (!contractor?.email) continue;

        newPending.push({
          taskId: task.id,
          oldStart: task.plannedStart,
          newStart: task.plannedStart,
          oldEnd: task.plannedEnd,
          newEnd: task.plannedEnd,
          shiftDays: 0,
          ruleId: rule.id,
          notificationType: 'deadline_reminder',
        });
      }
    }

    if (newPending.length > 0) appendPendingNotifications(newPending);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  return null;
}

/**
 * On app load, syncs confirmation statuses for any pending records.
 */
function ConfirmationSyncer() {
  const { notificationRecords, syncConfirmations } = useAppStore();

  useEffect(() => {
    const sentRecords = notificationRecords.filter(r => r.status === 'sent');
    if (sentRecords.length === 0) return;

    const tokens = sentRecords.map(r => r.token).join(',');
    fetch(`${API_BASE}/api/confirmations?tokens=${encodeURIComponent(tokens)}`)
      .then(r => r.json())
      .then((data: Record<string, string | null>) => {
        const confirmed: Record<string, string> = {};
        for (const [token, at] of Object.entries(data)) {
          if (at) confirmed[token] = at;
        }
        if (Object.keys(confirmed).length > 0) syncConfirmations(confirmed);
      })
      .catch(() => { /* silent — no network access */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  return null;
}

// ── Fields synced to Neon (excludes transient / huge data) ──────────────────
function extractSyncState(s: ReturnType<typeof useAppStore.getState>) {
  return {
    companies: s.companies,
    users: s.users,
    projects: s.projects,
    tasks: s.tasks,
    crafts: s.crafts,
    contractors: s.contractors,
    milestones: s.milestones,
    risks: s.risks,
    templates: s.templates,
    phases: s.phases,
    objects: s.objects,
    projectShares: s.projectShares,
    projectCraftAssignments: s.projectCraftAssignments,
    taskOrder: s.taskOrder,
    roles: s.roles,
    currentProjectId: s.currentProjectId,
    notificationSettings: s.notificationSettings,
    notificationRules: s.notificationRules,
    notificationRecords: s.notificationRecords,
    projectNotificationConfigs: s.projectNotificationConfigs,
  };
}

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'refreshed';

// Shared sync-status signal (simple module-level so Header can read it)
let _syncStatus: SyncStatus = 'idle';
let _syncListeners: Array<(s: SyncStatus) => void> = [];
export function getSyncStatus() { return _syncStatus; }
export function subscribeSyncStatus(fn: (s: SyncStatus) => void) {
  _syncListeners.push(fn);
  return () => { _syncListeners = _syncListeners.filter(l => l !== fn); };
}
function setSyncStatus(s: SyncStatus) {
  _syncStatus = s;
  _syncListeners.forEach(l => l(s));
}

const POLL_INTERVAL_MS = 5000;

/**
 * Loads app state from Neon on mount (cloud state wins over localStorage).
 * Debounce-saves every local change back to Neon.
 * Polls every 5 s for external changes — auto-reloads if another user saved.
 */
function CloudSync() {
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimestampRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    setSyncStatus('loading');

    // ── Initial load ──────────────────────────────────────────────────────────
    fetch(`${API_BASE}/api/state`)
      .then(r => r.json())
      .then((data: { state: unknown | null; updatedAt: string | null }) => {
        if (data.state && typeof data.state === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stateObj = data.state as any;
          // Migrate: add fields if Neon state predates this feature
          if (!stateObj.notificationRules) {
            stateObj.notificationRules = defaultNotificationRules;
          }
          if (!stateObj.projectNotificationConfigs) {
            stateObj.projectNotificationConfigs = [];
          }
          useAppStore.setState(stateObj);
          serverTimestampRef.current = data.updatedAt ?? null;
          loadedRef.current = true;
          setSyncStatus('idle');
        } else {
          // Neon is empty → push current localStorage state to Neon immediately
          serverTimestampRef.current = null;
          loadedRef.current = true;
          setSyncStatus('saving');
          const localState = extractSyncState(useAppStore.getState());
          fetch(`${API_BASE}/api/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: localState }),
          })
            .then(r => r.json())
            .then((res: { ok?: boolean; updatedAt?: string }) => {
              if (res.updatedAt) serverTimestampRef.current = res.updatedAt;
              setSyncStatus('saved');
              setTimeout(() => setSyncStatus('idle'), 2000);
            })
            .catch(() => {
              setSyncStatus('error');
              setTimeout(() => setSyncStatus('idle'), 4000);
            });
        }
      })
      .catch(() => {
        loadedRef.current = true;
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
      });

    // ── Debounce-save on every local change ───────────────────────────────────
    const unsubscribe = useAppStore.subscribe(() => {
      if (!loadedRef.current) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      savingRef.current = true;
      setSyncStatus('saving');

      saveTimerRef.current = setTimeout(() => {
        const syncState = extractSyncState(useAppStore.getState());
        fetch(`${API_BASE}/api/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: syncState }),
        })
          .then(r => r.json())
          .then((res: { ok?: boolean; updatedAt?: string }) => {
            if (res.updatedAt) serverTimestampRef.current = res.updatedAt;
            savingRef.current = false;
            setSyncStatus('saved');
            setTimeout(() => setSyncStatus('idle'), 2000);
          })
          .catch(() => {
            savingRef.current = false;
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 4000);
          });
      }, 2500);
    });

    // ── Poll every 5 s for external changes ───────────────────────────────────
    const pollInterval = setInterval(() => {
      if (!loadedRef.current || savingRef.current || saveTimerRef.current) return;

      fetch(`${API_BASE}/api/state`)
        .then(r => r.json())
        .then((data: { state: unknown | null; updatedAt: string | null }) => {
          if (!data.updatedAt) return;
          if (data.updatedAt && data.updatedAt !== serverTimestampRef.current) {
            serverTimestampRef.current = data.updatedAt;
            if (data.state && typeof data.state === 'object') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const stateObj = data.state as any;
              if (!stateObj.notificationRules) stateObj.notificationRules = defaultNotificationRules;
              if (!stateObj.projectNotificationConfigs) stateObj.projectNotificationConfigs = [];
              useAppStore.setState(stateObj);
              setSyncStatus('refreshed');
              setTimeout(() => setSyncStatus('idle'), 3000);
            }
          }
        })
        .catch(() => { /* silent poll failure */ });
    }, POLL_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Page error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500 p-8">
          <p className="text-lg font-semibold text-gray-700">Nastala chyba na stránce</p>
          <p className="text-sm text-red-500 font-mono bg-red-50 px-3 py-2 rounded">{(this.state.error as Error).message}</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700" onClick={() => this.setState({ error: null })}>
            Zkusit znovu
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { currentPage } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => !!sessionStorage.getItem('harmonogram-auth'));

  // ─── Detect share link: ?share=TOKEN ───
  const shareToken = new URLSearchParams(window.location.search).get('share');
  if (shareToken) {
    return <PublicView token={shareToken} />;
  }

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  const PageComponent = pages[currentPage] || Dashboard;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Background workers — render nothing visible */}
      <CloudSync />
      <NotificationProcessor />
      <ConfirmationSyncer />
      <DeadlineReminderProcessor />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={() => { sessionStorage.removeItem('harmonogram-auth'); setLoggedIn(false); }}
      />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen overflow-hidden">
        <Header onMenuOpen={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <ErrorBoundary key={currentPage}>
            <PageComponent />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
