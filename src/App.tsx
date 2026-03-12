import { useState, Component, type ErrorInfo, type ReactNode } from 'react';
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
};

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
