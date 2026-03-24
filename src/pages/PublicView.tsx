import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import GanttScheduler from './GanttScheduler';
import {
  GanttChartSquare, CheckSquare, AlertCircle,
  Building2, CalendarRange, Clock
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Nezahájeno',
  in_progress: 'Probíhá',
  completed: 'Dokončeno',
  delayed: 'Zpoždění',
  at_risk: 'V ohrožení',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  delayed: 'bg-red-100 text-red-700',
  at_risk: 'bg-orange-100 text-orange-700',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Nízká', medium: 'Střední', high: 'Vysoká', critical: 'Kritická',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

function formatDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

interface Props {
  token: string;
}

export default function PublicView({ token }: Props) {
  const { projectShares, projects, tasks, crafts, phases } = useAppStore();
  const [activeTab, setActiveTab] = useState<'gantt' | 'tasks'>('gantt');
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand persist to finish hydrating from localStorage
  useEffect(() => {
    // If already hydrated (sync localStorage), mark immediately
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
      return unsub;
    }
  }, []);

  // Show spinner while waiting for store hydration
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Načítám harmonogram…</p>
        </div>
      </div>
    );
  }

  const share = projectShares.find((s) => s.token === token);

  if (!share) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Odkaz není platný</h1>
          <p className="text-gray-500">
            Tento sdílený odkaz neexistuje nebo byl deaktivován. Kontaktujte správce projektu pro nový odkaz.
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Sdílené harmonogramy jsou dostupné pouze v prohlížeči, kde byl odkaz vygenerován.
          </p>
        </div>
      </div>
    );
  }

  const project = projects.find((p) => p.id === share.projectId);

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Projekt nenalezen</h1>
          <p className="text-gray-500">Projekt přidružený k tomuto odkazu již neexistuje.</p>
        </div>
      </div>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const doneTasks = projectTasks.filter((t) => t.status === 'completed').length;
  const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;

  const STATUS_PROJECT: Record<string, string> = {
    planning: 'Plánování', active: 'Aktivní', completed: 'Dokončeno', paused: 'Pozastaveno',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-black text-sm">T</span>
            </div>
            <div>
              <p className="font-black text-base leading-tight tracking-tight">Tesgrup</p>
              <p className="font-black text-sm leading-tight text-blue-400 tracking-tight">Development</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="bg-gray-700 rounded px-2 py-1">Pouze pro čtení</span>
          </div>
        </div>
      </header>

      {/* Project Info Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: project.color + '20' }}
              >
                <Building2 size={22} style={{ color: project.color }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    project.status === 'active' ? 'bg-green-100 text-green-700' :
                    project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    project.status === 'paused' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {STATUS_PROJECT[project.status]}
                  </span>
                  {project.address && (
                    <span className="text-xs text-gray-500">{project.address}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm flex-wrap">
              <div className="flex items-center gap-1.5 text-gray-600">
                <CalendarRange size={15} className="text-gray-400" />
                <span>{formatDate(project.plannedStart)} – {formatDate(project.plannedEnd)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Clock size={15} className="text-gray-400" />
                <span>{projectTasks.length} úkolů</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700">{progress}%</span>
              </div>
            </div>
          </div>
          {project.description && (
            <p className="mt-3 text-sm text-gray-500 max-w-2xl">{project.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('gantt')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'gantt'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <GanttChartSquare size={16} />
              Harmonogram práce
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tasks'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CheckSquare size={16} />
              Úkoly
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                {projectTasks.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'gantt' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <GanttScheduler lockedProjectId={project.id} hideToolbar hideContractors />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Seznam úkolů</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {projectTasks.length} úkolů · {doneTasks} dokončeno · {progress}% postup
              </p>
            </div>
            {projectTasks.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <CheckSquare size={40} className="mx-auto mb-3 opacity-40" />
                <p>Projekt nemá žádné úkoly</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Název úkolu</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Zahájení</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dokončení</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Postup</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stav</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Priorita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projectTasks.map((task, idx) => {
                      const phase = phases.find((ph) => ph.id === task.phaseId);
                      return (
                        <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{task.name}</div>
                            {phase && (
                              <div className="text-xs text-gray-400 mt-0.5">{phase.name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(task.plannedStart)}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(task.plannedEnd)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-200 rounded-full h-1.5 shrink-0">
                                <div
                                  className="h-1.5 rounded-full bg-blue-500"
                                  style={{ width: `${task.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{task.progressPercent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[task.status] || task.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-600'}`}>
                              {PRIORITY_LABELS[task.priority] || task.priority}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 pb-6 text-center text-xs text-gray-400">
        <p>Sdílený pohled · TESGRUP s.r.o. · Pouze pro čtení</p>
        <p className="mt-0.5">Vygenerováno systémem Tesgrup Development v1.0</p>
      </footer>
    </div>
  );
}
