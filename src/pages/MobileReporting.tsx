import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/helpers';
import { Smartphone, Camera, MessageSquare, AlertTriangle, CheckCircle, Play, Square } from 'lucide-react';
import type { MobileReport } from '../types';

const reportTypeIcon = (type: MobileReport['type']) => {
  const icons = {
    start: <Play size={14} className="text-blue-500" />,
    finish: <CheckCircle size={14} className="text-green-500" />,
    progress: <Square size={14} className="text-indigo-500" />,
    problem: <AlertTriangle size={14} className="text-red-500" />,
    note: <MessageSquare size={14} className="text-gray-500" />,
  };
  return icons[type] || icons.note;
};

const reportTypeLabel = (type: MobileReport['type']) => {
  const labels = { start: 'Zahájení', finish: 'Dokončení', progress: 'Postup', problem: 'Problém', note: 'Poznámka' };
  return labels[type] || type;
};

const reportTypeBg = (type: MobileReport['type']) => {
  const bgs = {
    start: 'bg-blue-50 border-blue-200',
    finish: 'bg-green-50 border-green-200',
    progress: 'bg-indigo-50 border-indigo-200',
    problem: 'bg-red-50 border-red-200',
    note: 'bg-gray-50 border-gray-200',
  };
  return bgs[type] || bgs.note;
};

export default function MobileReporting() {
  const { mobileReports, tasks, projects, users, addMobileReport, updateTask } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [filterProject, setFilterProject] = useState('');
  const [form, setForm] = useState({
    taskId: '',
    projectId: projects[0]?.id || '',
    type: 'progress' as MobileReport['type'],
    description: '',
    progressPercent: 50,
  });

  const sorted = [...mobileReports]
    .filter(r => filterProject ? r.projectId === filterProject : true)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const projectTasks = tasks.filter(t => t.projectId === form.projectId && t.status !== 'completed');

  const handleSubmit = () => {
    if (!form.taskId || !form.description) return;
    const task = tasks.find(t => t.id === form.taskId);
    if (!task) return;

    const report: MobileReport = {
      id: generateId(),
      taskId: form.taskId,
      projectId: form.projectId,
      reporterId: users[0]?.id || 'u1',
      type: form.type,
      description: form.description,
      photos: [],
      timestamp: new Date().toISOString(),
      progressPercent: form.type === 'progress' ? form.progressPercent : undefined,
    };

    addMobileReport(report);

    // Update task based on report type
    if (form.type === 'start') {
      updateTask(form.taskId, { status: 'in_progress', actualStart: new Date().toISOString().split('T')[0] });
    } else if (form.type === 'finish') {
      updateTask(form.taskId, { status: 'completed', actualEnd: new Date().toISOString().split('T')[0], progressPercent: 100 });
    } else if (form.type === 'progress') {
      updateTask(form.taskId, { progressPercent: form.progressPercent });
    } else if (form.type === 'problem') {
      updateTask(form.taskId, { status: 'at_risk' });
    }

    setShowForm(false);
    setForm({ taskId: '', projectId: projects[0]?.id || '', type: 'progress', description: '', progressPercent: 50 });
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Smartphone size={20} className="text-blue-500" /> Mobilní hlášení z terénu
          </h3>
          <p className="text-sm text-gray-500 mt-1">Stavbyvedoucí reportuje stav prací přímo ze staveniště</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Smartphone size={16} /> Nové hlášení
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Celkem hlášení', value: mobileReports.length, color: 'blue' },
          { label: 'Problémy', value: mobileReports.filter(r => r.type === 'problem').length, color: 'red' },
          { label: 'Dokončení', value: mobileReports.filter(r => r.type === 'finish').length, color: 'green' },
          { label: 'Dnes', value: mobileReports.filter(r => r.timestamp.startsWith(new Date().toISOString().split('T')[0])).length, color: 'indigo' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mobile-style Feed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-gray-700">Feed hlášení</h4>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Všechny projekty</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            {sorted.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
                <Smartphone size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400">Žádná hlášení</p>
              </div>
            ) : sorted.map(report => {
              const task = tasks.find(t => t.id === report.taskId);
              const project = projects.find(p => p.id === report.projectId);
              const reporter = users.find(u => u.id === report.reporterId);
              return (
                <div key={report.id} className={`border rounded-xl p-4 ${reportTypeBg(report.type)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {reportTypeIcon(report.type)}
                      <span className="font-medium text-gray-800 text-sm">{reportTypeLabel(report.type)}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatTimestamp(report.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{report.description}</p>
                  {report.progressPercent !== undefined && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 bg-white rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${report.progressPercent}%` }} />
                      </div>
                      <span className="text-xs font-medium">{report.progressPercent}%</span>
                    </div>
                  )}
                  <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                    {task && <span className="bg-white px-2 py-0.5 rounded border border-gray-200">📋 {task.name}</span>}
                    {project && <span className="bg-white px-2 py-0.5 rounded border border-gray-200">🏗 {project.name.substring(0, 25)}</span>}
                    {reporter && <span className="bg-white px-2 py-0.5 rounded border border-gray-200">👤 {reporter.name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Preview */}
        <div>
          <div className="bg-gray-900 rounded-[2rem] p-3 shadow-2xl border-4 border-gray-700 sticky top-4">
            <div className="bg-white rounded-[1.5rem] overflow-hidden">
              <div className="bg-blue-600 text-white p-4 text-center">
                <Smartphone size={20} className="mx-auto mb-1" />
                <p className="font-bold text-sm">Stavební Planovač</p>
                <p className="text-blue-200 text-xs">Mobilní hlášení</p>
              </div>
              <div className="p-3 space-y-2">
                {['start','finish','progress','problem','note'].map(type => (
                  <button key={type}
                    onClick={() => { setForm(f => ({ ...f, type: type as MobileReport['type'] })); setShowForm(true); }}
                    className={`w-full text-left p-3 rounded-xl border text-sm font-medium flex items-center gap-2 ${reportTypeBg(type as MobileReport['type'])}`}
                  >
                    {reportTypeIcon(type as MobileReport['type'])}
                    {reportTypeLabel(type as MobileReport['type'])}
                  </button>
                ))}
              </div>
              <div className="px-3 pb-4">
                <p className="text-xs text-gray-400 text-center mt-2">Stavbyvedoucí: Pavel Čermák</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Smartphone size={18} className="text-blue-500" /> Nové hlášení z terénu
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ hlášení</label>
                <div className="grid grid-cols-5 gap-1">
                  {(['start','finish','progress','problem','note'] as MobileReport['type'][]).map(type => (
                    <button key={type}
                      onClick={() => setForm(f => ({ ...f, type }))}
                      className={`p-2 rounded-lg border text-xs text-center transition-colors ${
                        form.type === type ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-center mb-1">{reportTypeIcon(type)}</div>
                      {reportTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
                <select value={form.projectId}
                  onChange={e => setForm(f => ({ ...f, projectId: e.target.value, taskId: '' }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Úkol</label>
                <select value={form.taskId}
                  onChange={e => setForm(f => ({ ...f, taskId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Vyberte úkol...</option>
                  {projectTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {form.type === 'progress' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postup: {form.progressPercent}%
                  </label>
                  <input type="range" min={0} max={100} step={5} value={form.progressPercent}
                    onChange={e => setForm(f => ({ ...f, progressPercent: Number(e.target.value) }))}
                    className="w-full accent-blue-600" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Popis / poznámka</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Popište aktuální stav prací..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={3} />
              </div>

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500">
                <Camera size={16} />
                <span>Nahrát fotografie (demo verze)</span>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSubmit}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700">
                Odeslat hlášení
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
