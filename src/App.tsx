import { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
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
      {/* Background notification processors — render nothing visible */}
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
