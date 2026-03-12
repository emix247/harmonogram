import { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { Bell, Search, Settings, CheckSquare, FolderOpen, Flag, AlertTriangle, Menu } from 'lucide-react';

const pageTitles: Record<string, string> = {
  dashboard: 'Přehled projektů',
  projects: 'Projekty',
  gantt: 'Harmonogram práce',
  tasks: 'Správa úkolů',
  crafts: 'Zhotovitelé',
  milestones: 'Milníky',
  templates: 'Projektové šablony',
  risks: 'Řízení rizik',
  reports: 'Přehledy & Reporty',
  mobile: 'Mobilní hlášení z terénu',
  cashflow: 'Cash Flow',
  history: 'Historie změn',
  settings: 'Nastavení',
};

interface Props {
  onMenuOpen: () => void;
}

export default function Header({ onMenuOpen }: Props) {
  const { currentPage, conflicts, projects, setCurrentPage, tasks, milestones, risks } = useAppStore();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // '/' shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setQuery('');
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: { type: string; label: string; sub: string; page: string; icon: typeof CheckSquare }[] = [];
    tasks.filter(t => t.name.toLowerCase().includes(q)).slice(0, 4).forEach(t => {
      const proj = projects.find(p => p.id === t.projectId);
      results.push({ type: 'task', label: t.name, sub: proj?.name || '', page: 'tasks', icon: CheckSquare });
    });
    projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 3).forEach(p => {
      results.push({ type: 'project', label: p.name, sub: p.address || '', page: 'projects', icon: FolderOpen });
    });
    milestones.filter(m => m.name.toLowerCase().includes(q)).slice(0, 2).forEach(m => {
      results.push({ type: 'milestone', label: m.name, sub: m.plannedDate, page: 'milestones', icon: Flag });
    });
    risks.filter(r => r.title.toLowerCase().includes(q)).slice(0, 2).forEach(r => {
      results.push({ type: 'risk', label: r.title, sub: '', page: 'risks', icon: AlertTriangle });
    });
    return results.slice(0, 8);
  }, [query, tasks, projects, milestones, risks]);

  const today = new Date().toISOString().split('T')[0];
  const notifications = [
    ...tasks.filter(t => t.status !== 'completed' && t.plannedEnd < today).slice(0, 4).map(t => ({
      type: 'delay', text: `Zpožděno: ${t.name}`, color: 'text-red-600',
    })),
    ...conflicts.slice(0, 3).map(c => ({
      type: 'conflict', text: c.description, color: 'text-orange-600',
    })),
  ];

  return (
    <header className="bg-white border-b border-gray-200 h-14 md:h-16 flex items-center px-3 md:px-6 gap-2 md:gap-4">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuOpen}
        className="md:hidden p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg shrink-0"
        aria-label="Otevřít menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h2 className="text-base md:text-xl font-semibold text-gray-800 truncate">{pageTitles[currentPage] || 'Stavební Planovač'}</h2>
      </div>

      {/* Global Search — hidden on mobile */}
      <div className="relative hidden md:block" ref={searchRef}>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Hledat... (/ pro rychlý přístup)"
            className="bg-transparent text-sm outline-none w-52"
            value={query}
            ref={searchInputRef}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
          />
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
            {searchResults.map((r, i) => {
              const Icon = r.icon;
              return (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                  onClick={() => { setCurrentPage(r.page); setSearchOpen(false); setQuery(''); }}
                >
                  <Icon size={15} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{r.label}</p>
                    {r.sub && <p className="text-xs text-gray-400 truncate">{r.sub}</p>}
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">{r.page}</span>
                </button>
              );
            })}
          </div>
        )}
        {searchOpen && query.trim().length >= 2 && searchResults.length === 0 && (
          <div className="absolute top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-4 py-3">
            <p className="text-sm text-gray-400">Nic nenalezeno</p>
          </div>
        )}
      </div>

      {/* Bell with notifications dropdown */}
      <div className="relative" ref={bellRef}>
        <button
          className="relative p-2 text-gray-500 hover:text-gray-700"
          onClick={() => setBellOpen(o => !o)}
        >
          <Bell size={20} />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {notifications.length}
            </span>
          )}
        </button>
        {bellOpen && (
          <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Upozornění</p>
            {notifications.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">Žádná upozornění</p>
            ) : (
              notifications.map((n, i) => (
                <div key={i} className="px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <p className={`text-sm ${n.color}`}>{n.text}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setCurrentPage('settings')}
        className={`p-2 transition-colors ${currentPage === 'settings' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
      >
        <Settings size={20} />
      </button>
    </header>
  );
}
