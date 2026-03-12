import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  LayoutDashboard, FolderOpen, GanttChartSquare, CheckSquare,
  Wrench, Flag, FileStack, AlertTriangle, BarChart3,
  Smartphone, DollarSign, History, Settings, ChevronDown, Layers, X, LogOut
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

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  planning: 'bg-yellow-400',
  paused: 'bg-orange-400',
  completed: 'bg-blue-400',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function Sidebar({ open, onClose, onLogout }: Props) {
  const { currentPage, setCurrentPage, conflicts, tasks, risks, milestones, projects, currentProjectId, setCurrentProjectId } = useAppStore();
  const [projectOpen, setProjectOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.plannedEnd < today).length;
  const openRisks = risks.filter(r => r.status === 'open').length;
  const overdueMilestones = milestones.filter(m => m.status === 'pending' && m.plannedDate < today).length;

  const badges: Record<string, number> = {
    tasks: overdueTasks,
    risks: openRisks + conflicts.length,
    milestones: overdueMilestones,
  };

  const selectedProject = projects.find(p => p.id === currentProjectId) ?? null;

  // Close project dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNav = (id: string) => {
    setCurrentPage(id);
    onClose(); // close sidebar on mobile after navigation
  };

  return (
    <aside
      className={`
        w-72 md:w-64 bg-gray-900 text-white flex flex-col h-screen
        fixed left-0 top-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}
    >
      {/* Logo + mobile close button */}
      <div className="p-4 border-b border-gray-700 flex items-start justify-between">
        <div>
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
        {/* Close button visible only on mobile */}
        <button
          onClick={onClose}
          className="md:hidden text-gray-400 hover:text-white p-1 -mr-1"
          aria-label="Zavřít menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Project Picker */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-700/60" ref={dropRef}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-1">Aktivní projekt</p>
        <button
          onClick={() => setProjectOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 transition-all text-left group"
        >
          {selectedProject ? (
            <>
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/10"
                style={{ backgroundColor: selectedProject.color }}
              />
              <span className="flex-1 text-sm font-medium text-white truncate">{selectedProject.name}</span>
            </>
          ) : (
            <>
              <Layers size={13} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-300">Všechny projekty</span>
            </>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 shrink-0 transition-transform ${projectOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {projectOpen && (
          <div className="mt-1.5 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
            <button
              onClick={() => { setCurrentProjectId(null); setProjectOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                !currentProjectId
                  ? 'bg-blue-600/30 text-blue-300'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <Layers size={13} className="shrink-0 text-gray-400" />
              <span className="flex-1 font-medium">Všechny projekty</span>
              {!currentProjectId && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
            </button>

            {projects.length > 0 && (
              <div className="border-t border-gray-700/60">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setCurrentProjectId(p.id); setProjectOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                      currentProjectId === p.id
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-300 hover:bg-gray-700/70 hover:text-white'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/20" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 font-medium truncate">{p.name}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status] || 'bg-gray-500'}`} />
                  </button>
                ))}
              </div>
            )}

            {projects.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-500 italic">Žádné projekty</p>
            )}
          </div>
        )}
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
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 md:py-2.5 text-left text-sm transition-colors ${
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

      {/* Footer: Settings + user info + logout */}
      <div className="border-t border-gray-700">
        <button
          onClick={() => handleNav('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
            currentPage === 'settings'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings size={17} />
          <span>Nastavení</span>
        </button>
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <p className="font-medium text-gray-400">TESGRUP s.r.o.</p>
            <p>Ing. Jan Novák</p>
            <p className="text-blue-400">Administrátor</p>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
            title="Odhlásit se"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
