import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { formatDate, generateId, statusColor, statusLabel } from '../utils/helpers';
import { AlertTriangle, Plus, Shield, TrendingUp } from 'lucide-react';
import type { Risk } from '../types';

const probImpactColor = (level: string) => {
  if (level === 'high') return 'bg-red-100 text-red-700';
  if (level === 'medium') return 'bg-orange-100 text-orange-700';
  return 'bg-green-100 text-green-700';
};

const riskScore = (r: Risk) => {
  const v = { low: 1, medium: 2, high: 3 };
  return (v[r.probability] || 1) * (v[r.impact] || 1);
};

const riskScoreColor = (score: number) => {
  if (score >= 6) return 'bg-red-500';
  if (score >= 3) return 'bg-orange-400';
  return 'bg-green-500';
};

export default function RiskManagement() {
  const { risks, projects, users, addRisk, updateRisk, deleteRisk } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Risk | null>(null);
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    projectId: '', taskId: '', title: '', description: '',
    probability: 'medium' as Risk['probability'],
    impact: 'medium' as Risk['impact'],
    status: 'open' as Risk['status'],
    mitigationPlan: '', owner: '',
    detectedAt: new Date().toISOString().split('T')[0],
  });

  const filtered = risks.filter(r =>
    (filterProject ? r.projectId === filterProject : true) &&
    (filterStatus ? r.status === filterStatus : true)
  ).sort((a, b) => riskScore(b) - riskScore(a));

  const openRisks = risks.filter(r => r.status === 'open');
  const highRisks = openRisks.filter(r => riskScore(r) >= 6);

  const openForm = (risk?: Risk) => {
    if (risk) {
      setEditing(risk);
      setForm({
        projectId: risk.projectId, taskId: risk.taskId || '',
        title: risk.title, description: risk.description,
        probability: risk.probability, impact: risk.impact,
        status: risk.status, mitigationPlan: risk.mitigationPlan,
        owner: risk.owner, detectedAt: risk.detectedAt,
      });
    } else {
      setEditing(null);
      setForm({
        projectId: projects[0]?.id || '', taskId: '', title: '', description: '',
        probability: 'medium', impact: 'medium', status: 'open',
        mitigationPlan: '', owner: users[0]?.name || '',
        detectedAt: new Date().toISOString().split('T')[0],
      });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.title || !form.projectId) return;
    if (editing) {
      updateRisk(editing.id, form);
    } else {
      addRisk({ id: generateId(), ...form });
    }
    setShowModal(false);
  };

  const matrixData = [
    { prob: 'Vysoká', levels: ['high', 'medium', 'low'] as const },
    { prob: 'Střední', levels: ['high', 'medium', 'low'] as const },
    { prob: 'Nízká', levels: ['high', 'medium', 'low'] as const },
  ];

  const matrixScores = [
    [9, 6, 3],
    [6, 4, 2],
    [3, 2, 1],
  ];

  const matrixColors = [
    ['bg-red-500', 'bg-red-400', 'bg-orange-400'],
    ['bg-red-400', 'bg-orange-400', 'bg-yellow-400'],
    ['bg-orange-400', 'bg-yellow-400', 'bg-green-400'],
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{openRisks.length}</div>
          <div className="text-sm text-red-600">Otevřená rizika</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{highRisks.length}</div>
          <div className="text-sm text-orange-600">Kritická rizika</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{risks.filter(r => r.status === 'mitigated').length}</div>
          <div className="text-sm text-blue-600">Zmírněna</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{risks.filter(r => r.status === 'closed').length}</div>
          <div className="text-sm text-green-600">Uzavřena</div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk list */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Všechny projekty</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Všechny stavy</option>
                <option value="open">Otevřená</option>
                <option value="mitigated">Zmírněná</option>
                <option value="closed">Uzavřená</option>
              </select>
            </div>
            <button onClick={() => openForm()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              <Plus size={16} /> Přidat riziko
            </button>
          </div>

          <div className="space-y-3">
            {filtered.map(risk => {
              const project = projects.find(p => p.id === risk.projectId);
              const score = riskScore(risk);
              return (
                <div key={risk.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${riskScoreColor(score)}`}>
                      {score}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-gray-800">{risk.title}</h4>
                          <p className="text-xs text-gray-400">{project?.name} • {risk.owner}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusColor(risk.status)}`}>
                          {statusLabel(risk.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{risk.description}</p>

                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${probImpactColor(risk.probability)}`}>
                          Pravd.: {statusLabel(risk.probability)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${probImpactColor(risk.impact)}`}>
                          Dopad: {statusLabel(risk.impact)}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(risk.detectedAt)}</span>
                      </div>

                      {risk.mitigationPlan && (
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs text-blue-700">
                          <Shield size={11} className="inline mr-1" />
                          <strong>Zmírnění:</strong> {risk.mitigationPlan}
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        {risk.status === 'open' && (
                          <>
                            <button onClick={() => updateRisk(risk.id, { status: 'mitigated' })}
                              className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                              Zmírnit
                            </button>
                            <button onClick={() => updateRisk(risk.id, { status: 'closed' })}
                              className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                              Uzavřít
                            </button>
                          </>
                        )}
                        <button onClick={() => openForm(risk)}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                          Upravit
                        </button>
                        <button onClick={() => deleteRisk(risk.id)}
                          className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                          Smazat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400">Žádná rizika nenalezena</p>
              </div>
            )}
          </div>
        </div>

        {/* Risk Matrix */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" /> Matice rizik
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left pb-2 text-gray-500">Pravd. \ Dopad</th>
                    <th className="text-center pb-2 text-gray-500">Nízký</th>
                    <th className="text-center pb-2 text-gray-500">Střední</th>
                    <th className="text-center pb-2 text-gray-500">Vysoký</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map((row, ri) => (
                    <tr key={row.prob}>
                      <td className="py-1 text-gray-500 font-medium">{row.prob}</td>
                      {matrixScores[ri].map((_score, ci) => {
                        const cnt = openRisks.filter(r => {
                          const probMap = { low: 0, medium: 1, high: 2 };
                          const impMap = { low: 0, medium: 1, high: 2 };
                          return probMap[r.probability] === (2 - ri) && impMap[r.impact] === ci;
                        }).length;
                        return (
                          <td key={ci} className="py-1 text-center">
                            <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center text-white font-bold ${matrixColors[ri][ci]}`}>
                              {cnt > 0 ? cnt : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded" /> Kritické (≥6)</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-400 rounded" /> Střední (3–5)</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-400 rounded" /> Nízké (1–2)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">{editing ? 'Upravit riziko' : 'Přidat riziko'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Název rizika</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pravděpodobnost</label>
                  <select value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value as Risk['probability'] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="low">Nízká</option>
                    <option value="medium">Střední</option>
                    <option value="high">Vysoká</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dopad</label>
                  <select value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value as Risk['impact'] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="low">Nízký</option>
                    <option value="medium">Střední</option>
                    <option value="high">Vysoký</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stav</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Risk['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="open">Otevřeno</option>
                  <option value="mitigated">Zmírněno</option>
                  <option value="closed">Uzavřeno</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plán zmírnění</label>
                <textarea value={form.mitigationPlan}
                  onChange={e => setForm(f => ({ ...f, mitigationPlan: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odpovědná osoba</label>
                  <input type="text" value={form.owner}
                    onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum detekce</label>
                  <input type="date" value={form.detectedAt}
                    onChange={e => setForm(f => ({ ...f, detectedAt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
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
