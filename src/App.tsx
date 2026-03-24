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
import { localToday } from './utils/helpers';

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
      notificationType: 'cascade' | 'deadline_reminder' | 'internal_reminder';
      ruleId?: string;
      emailSubject?: string; emailIntro?: string; emailFooter?: string; emailNote?: string;
      showConfirmButton?: boolean; ccEmails?: string[]; internalEmails?: string[];
      daysBeforeDeadline?: number;
    }> = [];

    for (const pending of pendingNotifications) {
      const task = tasks.find(t => t.id === pending.taskId);
      if (!task) continue;

      const rule = pending.ruleId ? rules.find(r => r.id === pending.ruleId) : undefined;
      const isInternal = pending.notificationType === 'internal_reminder';

      const project = projects.find(p => p.id === task.projectId);

      // For internal reminders skip contractor lookup — email goes to rule.internalEmails
      if (!isInternal) {
        const craft = crafts.find(c => c.id === task.craftId);
        const contractorId = task.contractorId || craft?.contractorId || '';
        const contractor = contractors.find(c => c.id === contractorId);
        if (!contractor?.email) continue;

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
            ? rule?.daysBeforeDeadline : undefined,
        });
      } else {
        // Internal reminder — no contractor needed
        const internalEmails = rule?.internalEmails ?? [];
        if (internalEmails.length === 0) continue; // skip if no recipients configured
        notifications.push({
          taskId: task.id,
          taskName: task.name,
          projectId: task.projectId,
          projectName: project?.name ?? task.projectId,
          contractorId: '',
          contractorName: '',
          contractorEmail: '',
          oldStart: task.plannedStart,
          newStart: task.plannedStart,
          oldEnd: task.plannedEnd,
          newEnd: task.plannedEnd,
          shiftDays: 0,
          notificationType: 'internal_reminder',
          ruleId: pending.ruleId,
          emailSubject: rule?.emailSubject,
          emailIntro: rule?.emailIntro,
          emailFooter: rule?.emailFooter,
          emailNote: rule?.emailNote,
          showConfirmButton: rule?.showConfirmButton ?? false,
          ccEmails: rule?.ccEmails,
          internalEmails,
          daysBeforeDeadline: rule?.daysBeforeDeadline,
        });
      }
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

    const today = localToday();
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
 * On app load, checks internal_reminder rules and queues notifications
 * for tasks whose plannedStart is rule.daysBeforeDeadline days from today.
 * Sends to rule.internalEmails — skips contractor lookup.
 */
function InternalReminderProcessor() {
  const {
    tasks, notificationRules, notificationRecords,
    appendPendingNotifications,
  } = useAppStore();

  useEffect(() => {
    const rules = notificationRules ?? defaultNotificationRules;
    const internalRules = rules.filter(r => r.enabled && r.trigger === 'internal_reminder');
    if (internalRules.length === 0) return;

    const today = localToday();
    const newPending: PendingNotification[] = [];

    for (const rule of internalRules) {
      if (!rule.internalEmails?.length) continue; // no recipients = skip

      const targetDate = addDaysStr(today, rule.daysBeforeDeadline);

      const matchingTasks = tasks.filter(t => {
        if (t.status === 'completed') return false;
        // If specific taskIds are set, only match those; otherwise use projectIds filter
        if (rule.internalTaskIds && rule.internalTaskIds.length > 0) {
          return rule.internalTaskIds.includes(t.id) && t.plannedStart === targetDate;
        }
        const projectOk = rule.projectIds.length === 0 || rule.projectIds.includes(t.projectId);
        return t.plannedStart === targetDate && projectOk;
      });

      for (const task of matchingTasks) {
        const alreadySent = notificationRecords.some(r =>
          r.taskId === task.id &&
          r.ruleId === rule.id &&
          r.notificationType === 'internal_reminder' &&
          r.sentAt?.startsWith(today)
        );
        if (alreadySent) continue;

        newPending.push({
          taskId: task.id,
          oldStart: task.plannedStart,
          newStart: task.plannedStart,
          oldEnd: task.plannedEnd,
          newEnd: task.plannedEnd,
          shiftDays: 0,
          ruleId: rule.id,
          notificationType: 'internal_reminder',
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

// ── Live conflict detection ───────────────────────────────────────────────────
/**
 * Watches tasks + crafts and recomputes craft-overlap conflicts on every change.
 * Replaces the old static sampleConflicts array.
 */
function ConflictDetector() {
  const { tasks, crafts, setConflicts } = useAppStore();

  useEffect(() => {
    const detected: ReturnType<typeof useAppStore.getState>['conflicts'] = [];

    for (const craft of crafts) {
      const craftTasks = tasks.filter(
        t => t.craftId === craft.id && t.status !== 'completed'
      );
      for (let i = 0; i < craftTasks.length; i++) {
        for (let j = i + 1; j < craftTasks.length; j++) {
          const a = craftTasks[i];
          const b = craftTasks[j];
          if (a.projectId === b.projectId) continue; // same project is fine
          const overlapStart = a.plannedStart > b.plannedStart ? a.plannedStart : b.plannedStart;
          const overlapEnd   = a.plannedEnd   < b.plannedEnd   ? a.plannedEnd   : b.plannedEnd;
          if (overlapStart <= overlapEnd) {
            detected.push({
              id: `conf-${craft.id}-${a.id}-${b.id}`,
              type: 'overlap',
              craftId: craft.id,
              taskIds: [a.id, b.id],
              description: `${craft.name} je plánováno na více projektech současně (${a.name} × ${b.name})`,
              severity: 'warning',
              date: overlapStart,
            });
          }
        }
      }
    }

    setConflicts(detected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, crafts]);

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
    mobileReports: s.mobileReports,
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
function CloudSync({ onReady }: { onReady?: () => void }) {
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
          onReady?.();
        } else {
          // Neon is empty → push current localStorage state to Neon immediately
          serverTimestampRef.current = null;
          loadedRef.current = true;
          setSyncStatus('saving');
          onReady?.();
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
        onReady?.();
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
          body: JSON.stringify({
            state: syncState,
            clientUpdatedAt: serverTimestampRef.current,   // stale-write guard
          }),
        })
          .then(r => {
            if (r.status === 409) {
              // Server has newer data — reload it instead of overwriting
              return r.json().then((conflict: { serverUpdatedAt?: string }) => {
                console.warn('[CloudSync] Conflict detected — reloading from server');
                return fetch(`${API_BASE}/api/state`)
                  .then(r2 => r2.json())
                  .then((fresh: { state: unknown; updatedAt: string | null }) => {
                    if (fresh.state && typeof fresh.state === 'object') {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const stateObj = fresh.state as any;
                      if (!stateObj.notificationRules) stateObj.notificationRules = defaultNotificationRules;
                      if (!stateObj.projectNotificationConfigs) stateObj.projectNotificationConfigs = [];
                      useAppStore.setState(stateObj);
                      serverTimestampRef.current = fresh.updatedAt ?? conflict.serverUpdatedAt ?? null;
                      setSyncStatus('refreshed');
                      setTimeout(() => setSyncStatus('idle'), 3000);
                    }
                    savingRef.current = false;
                  });
              });
            }
            return r.json().then((res: { ok?: boolean; updatedAt?: string }) => {
              if (res.updatedAt) serverTimestampRef.current = res.updatedAt;
              savingRef.current = false;
              setSyncStatus('saved');
              setTimeout(() => setSyncStatus('idle'), 2000);
            });
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
  // cloudReady: true once initial Neon fetch completes (or errors out)
  // If already logged in we don't need to wait → start as true
  const [cloudReady, setCloudReady] = useState(() => !!sessionStorage.getItem('harmonogram-auth'));

  // ─── Detect share link: ?share=TOKEN ───
  // shareCloudReady always starts false so we ALWAYS wait for Neon data before
  // rendering PublicView — regardless of login state. This prevents "Neplatný
  // odkaz" on fresh devices or when cloudReady is already true from a session.
  const shareToken = new URLSearchParams(window.location.search).get('share');
  const [shareCloudReady, setShareCloudReady] = useState(false);
  if (shareToken) {
    return (
      <>
        <CloudSync onReady={() => setShareCloudReady(true)} />
        {shareCloudReady ? (
          <PublicView token={shareToken} />
        ) : (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Načítám harmonogram…</p>
            </div>
          </div>
        )}
      </>
    );
  }

  const PageComponent = pages[currentPage] || Dashboard;

  // ─── Not logged in yet ───
  if (!loggedIn) {
    return (
      <>
        {/* CloudSync MUST run before login so Neon users are loaded into the store */}
        <CloudSync onReady={() => setCloudReady(true)} />
        {cloudReady ? (
          <Login onLogin={() => setLoggedIn(true)} />
        ) : (
          // Brief loading screen while fetching users from Neon
          <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-white font-black text-xl">T</span>
              </div>
              <p className="text-gray-400 text-sm">Načítám data…</p>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Background workers — render nothing visible */}
      <CloudSync />
      <ConflictDetector />
      <NotificationProcessor />
      <ConfirmationSyncer />
      <DeadlineReminderProcessor />
      <InternalReminderProcessor />

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
