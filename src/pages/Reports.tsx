import { useAppStore } from '../store/appStore';
import { formatCurrency } from '../utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer
} from 'recharts';
import { BarChart3, TrendingUp, Download } from 'lucide-react';

export default function Reports() {
  const { projects, tasks, crafts, risks, milestones } = useAppStore();

  const handleExportCSV = () => {
    const statusMap: Record<string, string> = {
      completed: 'Dokončeno', in_progress: 'Probíhá', not_started: 'Nezahájeno',
      delayed: 'Zpožděno', at_risk: 'Riziko',
    };
    const priorityMap: Record<string, string> = {
      critical: 'Kritická', high: 'Vysoká', medium: 'Střední', low: 'Nízká',
    };
    const rows = [
      ['Název úkolu', 'Projekt', 'Řemeslo', 'Zahájení', 'Dokončení', 'Stav', 'Priorita', 'Postup (%)', 'Plánované náklady (Kč)', 'Kritická cesta'],
      ...tasks.map(t => {
        const proj = projects.find(p => p.id === t.projectId);
        const craft = crafts.find(c => c.id === t.craftId);
        return [
          `"${t.name}"`,
          `"${proj?.name ?? ''}"`,
          `"${craft?.name ?? ''}"`,
          t.plannedStart,
          t.plannedEnd,
          statusMap[t.status] ?? t.status,
          priorityMap[t.priority] ?? t.priority,
          t.progressPercent,
          t.plannedCost ?? 0,
          t.isCritical ? 'Ano' : 'Ne',
        ].join(';');
      }),
    ];
    const csv = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-ukoly-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Task status breakdown
  const statusData = [
    { name: 'Dokončeno', value: tasks.filter(t => t.status === 'completed').length, color: '#10b981' },
    { name: 'Probíhá', value: tasks.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Riziko', value: tasks.filter(t => t.status === 'at_risk').length, color: '#f97316' },
    { name: 'Zpožděno', value: tasks.filter(t => t.status === 'delayed').length, color: '#ef4444' },
    { name: 'Nezahájeno', value: tasks.filter(t => t.status === 'not_started').length, color: '#6b7280' },
  ].filter(d => d.value > 0);

  // Project progress
  const projectProgressData = projects.map(p => {
    const projectTasks = tasks.filter(t => t.projectId === p.id);
    const done = projectTasks.filter(t => t.status === 'completed').length;
    const total = projectTasks.length;
    return {
      name: p.name.length > 20 ? p.name.substring(0, 20) + '…' : p.name,
      Plán: 100,
      'Skutečnost': total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  // Craft workload
  const craftWorkloadData = crafts.map(craft => {
    const activeTasks = tasks.filter(t => t.craftId === craft.id && t.status !== 'completed').length;
    return {
      name: craft.name.length > 12 ? craft.name.substring(0, 12) + '…' : craft.name,
      'Aktivní úkoly': activeTasks,
      'Kapacita': craft.availableTeams,
    };
  }).filter(d => d['Aktivní úkoly'] > 0 || d['Kapacita'] > 0);

  // Monthly cashflow forecast (6 months)
  const today = new Date();
  const cashflowData = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(today);
    month.setMonth(month.getMonth() + i);
    const monthStr = month.toISOString().substring(0, 7);
    const monthTasks = tasks.filter(t => t.plannedEnd && t.plannedEnd.startsWith(monthStr));
    const planned = monthTasks.reduce((sum, t) => sum + (t.plannedCost || 0), 0);
    return {
      name: month.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' }),
      'Plánované náklady': planned,
    };
  });

  // Risk summary
  const riskData = [
    { name: 'Otevřená', value: risks.filter(r => r.status === 'open').length, color: '#ef4444' },
    { name: 'Zmírněná', value: risks.filter(r => r.status === 'mitigated').length, color: '#3b82f6' },
    { name: 'Uzavřená', value: risks.filter(r => r.status === 'closed').length, color: '#10b981' },
  ].filter(d => d.value > 0);

  // Summary stats
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalPlannedCost = tasks.reduce((s, t) => s + (t.plannedCost || 0), 0);
  const criticalTasks = tasks.filter(t => t.isCritical && t.status !== 'completed').length;
  const completedMilestones = milestones.filter(m => m.status === 'completed').length;

  const kpiClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
    green: 'bg-green-50 border-green-200',
  };

  return (
    <div className="space-y-6">
      {/* Page header with export */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Celkový rozpočet', value: formatCurrency(totalBudget), sub: `${projects.length} projektů`, color: 'blue' },
          { label: 'Plánované náklady', value: formatCurrency(totalPlannedCost), sub: `${tasks.length} úkolů`, color: 'purple' },
          { label: 'Kritické úkoly', value: criticalTasks, sub: 'Na kritické cestě', color: 'orange' },
          { label: 'Splněné milníky', value: `${completedMilestones}/${milestones.length}`, sub: 'Milníků dokončeno', color: 'green' },
        ].map(card => (
          <div key={card.label} className={`${kpiClasses[card.color] ?? 'bg-gray-50 border-gray-200'} border rounded-xl p-4`}>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-500" /> Plán vs. skutečnost (%)
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={projectProgressData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val) => `${val}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Plán" fill="#e5e7eb" radius={[4,4,0,0]} />
              <Bar dataKey="Skutečnost" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Task Status Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Stav úkolů</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3}>
                  {statusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 text-sm">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-bold text-gray-800 ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Craft Workload */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-500" /> Vytíženost řemesel
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={craftWorkloadData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Kapacita" fill="#e5e7eb" radius={[0,4,4,0]} />
              <Bar dataKey="Aktivní úkoly" fill="#8b5cf6" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cashflow Forecast */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Cashflow forecast (6 měsíců)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cashflowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(val) => formatCurrency(Number(val))} />
              <Line type="monotone" dataKey="Plánované náklady" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk summary */}
      {riskData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Přehled rizik</h3>
          <div className="flex gap-4">
            {riskData.map(d => (
              <div key={d.name} className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-100">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-gray-600 text-sm">{d.name}</span>
                <span className="font-bold text-gray-800 ml-2 text-lg">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delay Report Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Report zpožděných úkolů</h3>
        {(() => {
          const today2 = new Date().toISOString().split('T')[0];
          const delayed = tasks.filter(t => t.status !== 'completed' && t.plannedEnd < today2);
          if (delayed.length === 0) {
            return <p className="text-green-600 text-sm">✓ Žádné zpožděné úkoly</p>;
          }
          return (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Úkol</th>
                  <th className="text-left py-2 font-medium text-gray-500">Projekt</th>
                  <th className="text-left py-2 font-medium text-gray-500">Plán. konec</th>
                  <th className="text-left py-2 font-medium text-gray-500">Zpoždění</th>
                  <th className="text-left py-2 font-medium text-gray-500">Postup</th>
                </tr>
              </thead>
              <tbody>
                {delayed.map(t => {
                  const project = projects.find(p => p.id === t.projectId);
                  const days = Math.round((new Date(today2).getTime() - new Date(t.plannedEnd).getTime()) / 86400000);
                  return (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-700">
                        {t.isCritical && <span className="text-red-500 mr-1">⚡</span>}
                        {t.name}
                      </td>
                      <td className="py-2 text-gray-500">{project?.name}</td>
                      <td className="py-2 text-gray-600">{t.plannedEnd}</td>
                      <td className="py-2">
                        <span className="text-red-600 font-medium">+{days} dní</span>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${t.progressPercent}%` }} />
                          </div>
                          <span className="text-xs">{t.progressPercent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>
    </div>
  );
}
