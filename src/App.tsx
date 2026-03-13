import { useState, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Login from './pages/Login';
import { useAppStore } from './store/appStore';
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
import type { NotificationRecord } from './types';

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

/**
 * Watches `pendingNotifications` in the store, calls /api/notify for each,
 * stores results as NotificationRecord entries, then clears the queue.
 */
function NotificationProcessor() {
  const {
    pendingNotifications, clearPendingNotifications,
    tasks, crafts, contractors, projects,
    notificationSettings, addNotificationRecord,
  } = useAppStore();

  useEffect(() => {
    if (pendingNotifications.length === 0) return;

    const globalEnabled = notificationSettings.find(s => s.projectId === '*')?.enabled ?? true;

    // Build notification payloads
    const notifications: Array<{
      taskId: string; taskName: string; projectId: string; projectName: string;
      contractorId: string; contractorName: string; contractorEmail: string;
      oldStart: string; newStart: string; oldEnd: string; newEnd: string; shiftDays: number;
    }> = [];

    for (const pending of pendingNotifications) {
      const task = tasks.find(t => t.id === pending.taskId);
      if (!task) continue;

      // Check if notifications are enabled for this project
      const perProject = notificationSettings.find(s => s.projectId === task.projectId);
      const enabled = perProject !== undefined ? perProject.enabled : globalEnabled;
      if (!enabled) continue;

      const craft = crafts.find(c => c.id === task.craftId);
      const contractorId = task.contractorId || craft?.contractorId || '';
      const contractor = contractors.find(c => c.id === contractorId);
      if (!contractor?.email) continue; // skip if no email

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
      });
    }

    // Clear pending immediately to avoid re-processing
    clearPendingNotifications();

    if (notifications.length === 0) return;

    // Call API
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
    notificationRecords: s.notificationRecords,
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

const POLL_INTERVAL_MS = 5000; // 5 seconds

/**
 * Loads app state from Neon on mount (cloud state wins over localStorage).
 * Debounce-saves every local change back to Neon.
 * Polls every 5 s for external changes — auto-reloads if another user saved.
 */
function CloudSync() {
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the updated_at we last saw from the server (detects external changes)
  const serverTimestampRef = useRef<string | null>(null);
  // While a save is in flight / pending, skip the poll reload to avoid clobbering local edits
  const savingRef = useRef(false);

  useEffect(() => {
    setSyncStatus('loading');

    // ── Initial load ──────────────────────────────────────────────────────────
    fetch(`${API_BASE}/api/state`)
      .then(r => r.json())
      .then((data: { state: unknown | null; updatedAt: string | null }) => {
        if (data.state && typeof data.state === 'object') {
          // Neon has data → it is the source of truth, overwrite localStorage
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useAppStore.setState(data.state as any);
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
            // Store the timestamp we just saved — poll won't reload our own save
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
          // If the server timestamp is newer than what we last loaded/saved, reload
          if (data.updatedAt && data.updatedAt !== serverTimestampRef.current) {
            serverTimestampRef.current = data.updatedAt;
            if (data.state && typeof data.state === 'object') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              useAppStore.setState(data.state as any);
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
