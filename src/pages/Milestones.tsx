import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { formatDate, generateId, statusColor, statusLabel } from '../utils/helpers';
import { Plus, Flag, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import type { Milestone } from '../types';

const milestoneColors = ['#10b981','#3b82f6','#8b5cf6','#f97316','#ef4444','#06b6d4','#ec4899'];

export default function Milestones() {
  const { milestones, projects, addMilestone, updateMilestone, deleteMilestone } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [filterProject, setFilterProject] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', projectId: '', plannedDate: '',
    status: 'pending' as Milestone['status'], color: '#3b82f6'
  });

  const today = new Date().toISOString().split('T')[0];

  const filtered = milestones.filter(m => filterProject ? m.projectId === filterProject : true);
  const sorted = [...filtered].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

  const completed = filtered.filter(m => m.status === 'completed').length;
  const pending = filtered.filter(m => m.status === 'pending').length;
  const delayed = filtered.filter(m => m.status === 'delayed' || (m.status === 'pending' && m.plannedDate < today)).length;

  const openForm = (milestone?: Milestone) => {
    if (milestone) {
      setEditing(milestone);
      setForm({
        name: milestone.name, description: milestone.description,
        projectId: milestone.projectId, plannedDate: milestone.plannedDate,
        status: milestone.status, color: milestone.color
      });
    } else {
      setEditing(null);
      setForm({ name:'', description:'', projectId: projects[0]?.id || '', plannedDate: today, status: 'pending', color: '#3b82f6' });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name || !form.projectId || !form.plannedDate) return;
    if (editing) {
      updateMilestone(editing.id, form);
    } else {
      addMilestone({ id: generateId(), ...form });
    }
    setShowModal(false);
  };

  const getStatusIcon = (m: Milestone) => {
    if (m.status === 'completed') return <CheckCircle size={16} className="text-green-500" />;
    if (m.status === 'delayed' || (m.status === 'pending' && m.plannedDate < today)) return <AlertTriangle size={16} className="text-red-500" />;
    return <Clock size={16} className="text-blue-500" />;
  };

  const getDaysInfo = (m: Milestone) => {
    const diff = Math.round((new Date(m.plannedDate).getTime() - new Date(today).getTime()) / 86400000);
    if (m.status === 'completed') return <span className="text-green-600 text-xs">Dokončeno</span>;
    if (diff < 0) return <span className="text-red-600 text-xs font-medium">Zpožděno o {Math.abs(diff)} dní</span>;
    if (diff === 0) return <span className="text-orange-600 text-xs font-medium">Dnes!</span>;
    return <span className="text-gray-500 text-xs">Za {diff} dní</span>;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{completed}</div>
          <div className="text-sm text-green-600">Dokončeno</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{pending}</div>
          <div className="text-sm text-blue-600">Plánováno</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{delayed}</div>
          <div className="text-sm text-red-600">Zpožděno</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center">
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Všechny projekty</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => openForm()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus size={16} /> Přidat milník
        </button>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <Flag size={18} className="text-purple-500" /> Časová osa milníků
        </h3>
        {sorted.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Žádné milníky</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {sorted.map((m) => {
                const project = projects.find(p => p.id === m.projectId);
                const isLate = m.status === 'pending' && m.plannedDate < today;
                return (
                  <div key={m.id} className="relative flex items-start gap-4 pl-10">
                    <div
                      className="absolute left-2 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
                      style={{ backgroundColor: m.color, top: '2px' }}
                    >
                      {m.status === 'completed' && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div className={`flex-1 border rounded-xl p-4 ${isLate ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(m)}
                            <h4 className="font-medium text-gray-800">{m.name}</h4>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{project?.name}</p>
                          {m.description && <p className="text-sm text-gray-600 mt-1">{m.description}</p>}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className="text-sm font-medium text-gray-700">{formatDate(m.plannedDate)}</span>
                          {getDaysInfo(m)}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>
                            {statusLabel(m.status)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {m.status !== 'completed' && (
                          <button
                            onClick={() => updateMilestone(m.id, { status: 'completed', actualDate: today })}
                            className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                          >
                            ✓ Označit jako dokončeno
                          </button>
                        )}
                        <button onClick={() => openForm(m)}
                          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                          Upravit
                        </button>
                        <button onClick={() => deleteMilestone(m.id)}
                          className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                          Smazat
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">{editing ? 'Upravit milník' : 'Přidat milník'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Název milníku</label>
                <input type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="např. Dokončení hrubé stavby"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plánované datum</label>
                <input type="date" value={form.plannedDate}
                  onChange={e => setForm(f => ({ ...f, plannedDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stav</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Milestone['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="pending">Plánováno</option>
                  <option value="completed">Dokončeno</option>
                  <option value="delayed">Zpožděno</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Barva</label>
                <div className="flex gap-2">
                  {milestoneColors.map(color => (
                    <button key={color} onClick={() => setForm(f => ({ ...f, color }))}
                      className={`w-7 h-7 rounded-full border-2 ${form.color === color ? 'border-gray-800' : 'border-transparent'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSave}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700">Uložit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
