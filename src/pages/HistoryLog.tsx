import { useAppStore } from '../store/appStore';
import { History, User, Clock, Edit3 } from 'lucide-react';

const actionColors: Record<string, string> = {
  zahájení: 'bg-blue-100 text-blue-700',
  dokončení: 'bg-green-100 text-green-700',
  úprava: 'bg-orange-100 text-orange-700',
  smazání: 'bg-red-100 text-red-700',
  vytvoření: 'bg-purple-100 text-purple-700',
  hlášení: 'bg-indigo-100 text-indigo-700',
};

const actionIcon = (action: string) => {
  if (action === 'dokončení') return '✓';
  if (action === 'zahájení') return '▶';
  if (action === 'úprava') return '✎';
  if (action === 'smazání') return '✕';
  if (action === 'vytvoření') return '+';
  return '•';
};

export default function HistoryLog() {
  const { taskLogs, mobileReports, tasks, projects, users } = useAppStore();

  // Combine logs and mobile reports into unified timeline
  const allEvents = [
    ...taskLogs.map(log => ({
      id: log.id,
      type: 'log' as const,
      timestamp: log.timestamp,
      action: log.action,
      description: log.description,
      taskId: log.taskId,
      projectId: log.projectId,
      userId: log.userId,
      oldValue: log.oldValue,
      newValue: log.newValue,
    })),
    ...mobileReports.map(r => ({
      id: r.id,
      type: 'mobile' as const,
      timestamp: r.timestamp,
      action: 'hlášení',
      description: r.description,
      taskId: r.taskId,
      projectId: r.projectId,
      userId: r.reporterId,
      oldValue: undefined,
      newValue: r.progressPercent !== undefined ? `${r.progressPercent}%` : undefined,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return {
      date: d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // Group by date
  const grouped: Record<string, typeof allEvents> = {};
  allEvents.forEach(event => {
    const date = event.timestamp.split('T')[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(event);
  });

  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === today.toISOString().split('T')[0]) return 'Dnes';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Včera';
    return d.toLocaleDateString('cs-CZ', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <History size={20} className="text-gray-500" /> Historie změn
          </h3>
          <p className="text-sm text-gray-500 mt-1">Kompletní audit trail všech akcí v systému</p>
        </div>
        <div className="bg-gray-100 rounded-xl px-4 py-2 text-sm text-gray-600">
          Celkem záznamů: <strong>{allEvents.length}</strong>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Všechny záznamy', value: allEvents.length, color: 'bg-gray-50 border-gray-200' },
          { label: 'Hlášení z terénu', value: mobileReports.length, color: 'bg-blue-50 border-blue-200' },
          { label: 'Změny úkolů', value: taskLogs.length, color: 'bg-purple-50 border-purple-200' },
          { label: 'Dnes', value: allEvents.filter(e => e.timestamp.startsWith(new Date().toISOString().split('T')[0])).length, color: 'bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
            <div className="text-xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      {dateKeys.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
          <History size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400">Historie je prázdná</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dateKeys.map(date => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {formatDateHeader(date)}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="space-y-2">
                {grouped[date].map(event => {
                  const task = tasks.find(t => t.id === event.taskId);
                  const project = projects.find(p => p.id === event.projectId);
                  const user = users.find(u => u.id === event.userId);
                  const { time } = formatTimestamp(event.timestamp);
                  const colorClass = actionColors[event.action] || 'bg-gray-100 text-gray-700';

                  return (
                    <div key={event.id} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4 hover:border-gray-200 transition-colors">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${colorClass}`}>
                          {actionIcon(event.action)}
                        </div>
                        <div className="w-px flex-1 bg-gray-100 mt-2 min-h-2" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                              {event.action}
                            </span>
                            {event.type === 'mobile' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                📱 Mobilní
                              </span>
                            )}
                            {task && <span className="text-xs text-gray-500">📋 {task.name}</span>}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={11} /> {time}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{event.description}</p>
                        <div className="flex gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                          {project && (
                            <span className="flex items-center gap-1">
                              🏗 {project.name.length > 30 ? project.name.substring(0, 30) + '…' : project.name}
                            </span>
                          )}
                          {user && (
                            <span className="flex items-center gap-1">
                              <User size={11} /> {user.name}
                            </span>
                          )}
                          {event.oldValue && event.newValue && (
                            <span className="flex items-center gap-1">
                              <Edit3 size={11} />
                              <span className="line-through text-red-400">{event.oldValue}</span>
                              → <span className="text-green-600">{event.newValue}</span>
                            </span>
                          )}
                          {event.newValue && !event.oldValue && (
                            <span className="text-blue-500">Postup: {event.newValue}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
