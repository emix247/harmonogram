import { useAppStore } from '../store/appStore';
import {
  formatDate, formatCurrency, statusColor, statusLabel,
  getEffectiveProgress, localToday, getDaysBetween, countWorkdays,
} from '../utils/helpers';
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Flag, Activity, Building2, Minus,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Weighted-average effective progress across all tasks of a project. */
function calcActualProgress(
  projectTasks: ReturnType<typeof useAppStore.getState>['tasks'],
  today: string
): number {
  if (projectTasks.length === 0) return 0;
  let totalW = 0, sum = 0;
  for (const t of projectTasks) {
    const w = countWorkdays(t.plannedStart, t.plannedEnd);
    sum += getEffectiveProgress(t, today) * w;
    totalW += w;
  }
  return totalW > 0 ? Math.round(sum / totalW) : 0;
}

/** How far along we "should" be today based purely on calendar time. */
function calcExpectedProgress(plannedStart: string, plannedEnd: string, today: string): number {
  const total = getDaysBetween(plannedStart, plannedEnd);
  if (total <= 0) return 0;
  const elapsed = getDaysBetween(plannedStart, today);
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

type ScheduleSignal = {
  delta: number;
  deltaDays: number;
  variant: 'ahead' | 'ontrack' | 'behind';
};

function calcScheduleSignal(
  project: { plannedStart: string; plannedEnd: string; status: string },
  projectTasks: ReturnType<typeof useAppStore.getState>['tasks'],
  today: string
): ScheduleSignal | null {
  if (project.status === 'completed' || today < project.plannedStart) return null;
  const actual    = calcActualProgress(projectTasks, today);
  const expected  = calcExpectedProgress(project.plannedStart, project.plannedEnd, today);
  const delta     = actual - expected;
  const totalDays = getDaysBetween(project.plannedStart, project.plannedEnd);
  const deltaDays = Math.max(1, Math.round(Math.abs(delta) * totalDays / 100));
  if (delta >= 5)  return { delta, deltaDays, variant: 'ahead' };
  if (delta <= -5) return { delta, deltaDays, variant: 'behind' };
  return { delta, deltaDays: 0, variant: 'ontrack' };
}

const signalCfg: Record<
  ScheduleSignal['variant'],
  { bg: string; text: string; border: string; Icon: React.ElementType; label: string }
> = {
  ahead:   { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300', Icon: TrendingUp,   label: 'Předstih' },
  ontrack: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', Icon: Minus,        label: 'Na plán'  },
  behind:  { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300',   Icon: TrendingDown, label: 'Zpoždění' },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { projects, tasks, milestones, risks, crafts, setCurrentPage } = useAppStore();

  const today = localToday();

  const activeProjects = projects.filter(p => p.status === 'active');
  const todayTasks = tasks.filter(t =>
    t.plannedStart <= today && t.plannedEnd >= today && t.status !== 'completed'
  );
  const criticalTasks = tasks.filter(t => t.isCritical && t.status !== 'completed');
  const delayedTasks = tasks.filter(t => t.status === 'delayed' || (t.plannedEnd < today && t.status !== 'completed'));
  const openRisks = risks.filter(r => r.status === 'open');
  const upcomingMilestones = milestones.filter(m => m.status === 'pending' && m.plannedDate >= today).slice(0, 5);

  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statCards = [
    { label: 'Aktivní projekty', value: activeProjects.length, icon: Building2, color: 'blue', sub: `${projects.length} celkem`, page: 'projects' },
    { label: 'Dnešní úkoly', value: todayTasks.length, icon: Clock, color: 'indigo', sub: 'Právě probíhají', page: 'tasks' },
    { label: 'Kritické úkoly', value: criticalTasks.length, icon: Activity, color: 'orange', sub: 'Na kritické cestě', page: 'tasks' },
    { label: 'Zpožděné úkoly', value: delayedTasks.length, icon: AlertTriangle, color: 'red', sub: 'Vyžadují pozornost', page: 'tasks' },
    { label: 'Otevřená rizika', value: openRisks.length, icon: AlertTriangle, color: 'red', sub: 'Vyžadují akci', page: 'risks' },
    { label: 'Celkový rozpočet', value: formatCurrency(totalBudget), icon: TrendingUp, color: 'green', sub: 'Všechny projekty', page: 'cashflow' },
    { label: 'Celkový postup', value: `${overallProgress}%`, icon: CheckCircle, color: 'teal', sub: `${completedTasks}/${totalTasks} úkolů`, page: 'reports' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow ${colorMap[card.color]}`} onClick={() => setCurrentPage(card.page)}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium opacity-80">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                  <p className="text-xs opacity-60 mt-1">{card.sub}</p>
                </div>
                <Icon size={24} className="opacity-60" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-blue-500" /> Aktivní projekty
          </h3>
          <div className="space-y-4">
            {activeProjects.map((project) => {
              const projectTasks = tasks.filter(t => t.projectId === project.id);
              const progress  = calcActualProgress(projectTasks, today);
              const expected  = calcExpectedProgress(project.plannedStart, project.plannedEnd, today);
              const signal    = calcScheduleSignal(project, projectTasks, today);
              const cfg = signal ? signalCfg[signal.variant] : null;
              const SignalIcon = cfg?.Icon;
              return (
                <div key={project.id} className="border border-gray-100 rounded-lg p-4">
                  {/* Header row */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-gray-800">{project.name}</h4>
                      <p className="text-sm text-gray-500">{project.address}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ml-2 shrink-0 ${statusColor(project.status)}`}>
                      {statusLabel(project.status)}
                    </span>
                  </div>

                  {/* Schedule signal badge — full-width, prominent */}
                  {signal && cfg && SignalIcon && (
                    <div
                      title={`Aktuální postup ${progress} % vs. očekávaný ${expected} %`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 ${cfg.bg} ${cfg.border}`}
                    >
                      <SignalIcon size={16} className={cfg.text} />
                      <span className={`font-bold text-sm ${cfg.text}`}>{cfg.label}</span>
                      {signal.variant !== 'ontrack' && (
                        <>
                          <span className={`font-semibold text-sm ${cfg.text}`}>
                            {signal.variant === 'ahead' ? '+' : '−'}{signal.deltaDays} dní
                          </span>
                          <span className={`text-xs opacity-70 ${cfg.text}`}>
                            ({signal.variant === 'ahead' ? '+' : '−'}{Math.abs(signal.delta)} %)
                          </span>
                        </>
                      )}
                      <span className={`ml-auto text-xs opacity-60 ${cfg.text}`}>
                        postup {progress} % · plán {expected} %
                      </span>
                    </div>
                  )}

                  {/* Progress bar with expected marker */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                      {expected > 0 && expected <= 100 && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-500 rounded"
                          style={{ left: `${expected}%` }}
                          title={`Očekávaný postup: ${expected} %`}
                        />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-10 text-right">{progress}%</span>
                  </div>

                  {/* Footer row */}
                  <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>Plán: {formatDate(project.plannedStart)} – {formatDate(project.plannedEnd)}</span>
                    <span>{formatCurrency(project.budget)}</span>
                  </div>
                </div>
              );
            })}
            {activeProjects.length === 0 && (
              <p className="text-gray-400 text-sm">Žádné aktivní projekty</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Upcoming Milestones */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Flag size={16} className="text-purple-500" /> Nadcházející milníky
            </h3>
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-gray-400">Žádné milníky</p>
            ) : (
              <div className="space-y-2">
                {upcomingMilestones.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-700">{m.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(m.plannedDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open Risks */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-500" /> Otevřená rizika
            </h3>
            {openRisks.length === 0 ? (
              <p className="text-sm text-gray-400">Žádná rizika</p>
            ) : (
              <div className="space-y-2">
                {openRisks.slice(0, 3).map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-lg p-2">
                    <p className="text-sm font-medium text-gray-700">{r.title}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                        Pravd.: {statusLabel(r.probability)}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                        Dopad: {statusLabel(r.impact)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-indigo-500" /> Dnešní úkoly ({todayTasks.length})
        </h3>
        {todayTasks.length === 0 ? (
          <p className="text-gray-400 text-sm">Dnes žádné úkoly</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Úkol</th>
                  <th className="text-left py-2 font-medium text-gray-500">Projekt</th>
                  <th className="text-left py-2 font-medium text-gray-500">Řemeslo</th>
                  <th className="text-left py-2 font-medium text-gray-500">Postup</th>
                  <th className="text-left py-2 font-medium text-gray-500">Stav</th>
                </tr>
              </thead>
              <tbody>
                {todayTasks.map(task => {
                  const project = projects.find(p => p.id === task.projectId);
                  const craft = crafts.find(c => c.id === task.craftId);
                  return (
                    <tr key={task.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-700">
                        {task.isCritical && <span className="text-red-500 mr-1">⚡</span>}
                        {task.name}
                      </td>
                      <td className="py-2 text-gray-500">{project?.name}</td>
                      <td className="py-2">
                        {craft && (
                          <span className="px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: craft.color }}>
                            {craft.name}
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${task.progressPercent}%` }} />
                          </div>
                          <span className="text-xs">{task.progressPercent}%</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(task.status)}`}>
                          {statusLabel(task.status)}
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
    </div>
  );
}
