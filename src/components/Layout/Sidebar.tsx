import { useAppStore } from '../../store/appStore';
import {
  LayoutDashboard, FolderOpen, GanttChartSquare, CheckSquare,
  Wrench, Flag, FileStack, AlertTriangle, BarChart3,
  Smartphone, DollarSign, History, Settings
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Přehled' },
  { id: 'projects', icon: FolderOpen, label: 'Projekty' },
  { id: 'gantt', icon: GanttChartSquare, label: 'Harmonogram práce' },
  { id: 'tasks', icon: CheckSquare, label: 'Úkoly' },
  { id: 'crafts', icon: Wrench, label: 'Řemesla & Zhotovitelé' },
  { id: 'milestones', icon: Flag, label: 'Milníky' },
  { id: 'templates', icon: FileStack, label: 'Šablony' },
  { id: 'risks', icon: AlertTriangle, label: 'Řízení rizik' },
  { id: 'reports', icon: BarChart3, label: 'Přehledy & Reporty' },
  { id: 'mobile', icon: Smartphone, label: 'Mobilní hlášení' },
  { id: 'cashflow', icon: DollarSign, label: 'Cash Flow' },
  { id: 'history', icon: History, label: 'Historie' },
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, conflicts, tasks, risks, milestones } = useAppStore();

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.plannedEnd < today).length;
  const openRisks = risks.filter(r => r.status === 'open').length;
  const overdueMilestones = milestones.filter(m => m.status === 'pending' && m.plannedDate < today).length;

  const badges: Record<string, number> = {
    tasks: overdueTasks,
    risks: openRisks + conflicts.length,
    milestones: overdueMilestones,
  };

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm">T</span>
          </div>
          <div>
            <h1 className="font-black text-base leading-tight tracking-tight">Tesgrup</h1>
            <h2 className="font-black text-base leading-tight text-blue-400 tracking-tight">Development</h2>
          </div>
        </div>
        <p className="text-gray-400 text-xs mt-1.5">v1.0 – Plánování staveb</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const badge = badges[item.id] || 0;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={17} />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: Settings + user info */}
      <div className="border-t border-gray-700">
        <button
          onClick={() => setCurrentPage('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
            currentPage === 'settings'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings size={17} />
          <span>Nastavení</span>
        </button>
        <div className="px-4 py-3 text-xs text-gray-500">
          <p className="font-medium text-gray-400">TESGRUP s.r.o.</p>
          <p>Ing. Jan Novák</p>
          <p className="text-blue-400">Administrátor</p>
        </div>
      </div>
    </aside>
  );
}
