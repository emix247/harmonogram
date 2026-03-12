import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDate, statusColor, statusLabel } from '../utils/helpers';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import type { Task } from '../types';

export default function Cashflow() {
  const { tasks, projects, updateTask } = useAppStore();
  const [filterProject, setFilterProject] = useState('');
  const [viewMode, setViewMode] = useState<'monthly' | 'quarterly'>('monthly');

  const filteredTasks = tasks.filter(t =>
    (filterProject ? t.projectId === filterProject : true) &&
    t.plannedCost && t.plannedCost > 0
  );

  // Total stats
  const totalPlanned = filteredTasks.reduce((s, t) => s + (t.plannedCost || 0), 0);
  const totalPaid = filteredTasks.filter(t => t.paymentStatus === 'paid').reduce((s, t) => s + (t.plannedCost || 0), 0);
  const totalInvoiced = filteredTasks.filter(t => t.paymentStatus === 'invoiced').reduce((s, t) => s + (t.plannedCost || 0), 0);
  const totalPending = filteredTasks.filter(t => t.paymentStatus === 'pending').reduce((s, t) => s + (t.plannedCost || 0), 0);

  // Monthly cashflow
  const today = new Date();
  const getMonthData = (months: number) => {
    return Array.from({ length: months }, (_, i) => {
      const month = new Date(today.getFullYear(), today.getMonth() - Math.floor(months / 2) + i, 1);
      const monthStr = month.toISOString().substring(0, 7);
      const monthTasks = filteredTasks.filter(t => t.plannedEnd && t.plannedEnd.startsWith(monthStr));
      const planned = monthTasks.reduce((s, t) => s + (t.plannedCost || 0), 0);
      const paid = monthTasks.filter(t => t.paymentStatus === 'paid').reduce((s, t) => s + (t.plannedCost || 0), 0);
      const invoiced = monthTasks.filter(t => t.paymentStatus === 'invoiced').reduce((s, t) => s + (t.plannedCost || 0), 0);
      return {
        name: month.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' }),
        'Plánované náklady': planned,
        'Zaplaceno': paid,
        'Fakturováno': invoiced,
      };
    });
  };

  const chartData = getMonthData(viewMode === 'monthly' ? 12 : 8);

  // Project breakdown
  const projectBreakdown = projects.map(p => {
    const pTasks = filteredTasks.filter(t => t.projectId === p.id);
    return {
      project: p,
      planned: pTasks.reduce((s, t) => s + (t.plannedCost || 0), 0),
      paid: pTasks.filter(t => t.paymentStatus === 'paid').reduce((s, t) => s + (t.plannedCost || 0), 0),
      invoiced: pTasks.filter(t => t.paymentStatus === 'invoiced').reduce((s, t) => s + (t.plannedCost || 0), 0),
      taskCount: pTasks.length,
    };
  }).filter(pb => pb.planned > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-blue-600">Celkové náklady</p>
              <p className="text-xl font-bold text-blue-800 mt-1">{formatCurrency(totalPlanned)}</p>
            </div>
            <DollarSign className="text-blue-400" size={20} />
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-green-600">Zaplaceno</p>
              <p className="text-xl font-bold text-green-800 mt-1">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-green-500">{totalPlanned > 0 ? Math.round(totalPaid / totalPlanned * 100) : 0}% z celku</p>
            </div>
            <TrendingUp className="text-green-400" size={20} />
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-orange-600">Fakturováno</p>
              <p className="text-xl font-bold text-orange-800 mt-1">{formatCurrency(totalInvoiced)}</p>
              <p className="text-xs text-orange-500">Čeká na platbu</p>
            </div>
            <Clock className="text-orange-400" size={20} />
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Nefakturováno</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(totalPending)}</p>
              <p className="text-xs text-gray-500">Budoucí náklady</p>
            </div>
            <TrendingDown className="text-gray-400" size={20} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-gray-800">Cashflow přehled</h3>
          <div className="flex gap-2">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Všechny projekty</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[{ id: 'monthly', label: 'Měsíčně' }, { id: 'quarterly', label: 'Čtvrtletně' }].map(m => (
                <button key={m.id}
                  onClick={() => setViewMode(m.id as typeof viewMode)}
                  className={`px-3 py-1 rounded text-xs font-medium ${viewMode === m.id ? 'bg-white shadow' : 'text-gray-500'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(val) => formatCurrency(Number(val))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Plánované náklady" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} />
            <Area type="monotone" dataKey="Zaplaceno" stroke="#10b981" fill="#d1fae5" strokeWidth={2} />
            <Area type="monotone" dataKey="Fakturováno" stroke="#f97316" fill="#fed7aa" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Project Breakdown */}
      {projectBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Přehled nákladů dle projektu</h3>
          <div className="space-y-4">
            {projectBreakdown.map(pb => (
              <div key={pb.project.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-800">{pb.project.name}</h4>
                    <p className="text-xs text-gray-400">{pb.taskCount} úkolů s náklady</p>
                  </div>
                  <span className="font-bold text-gray-800">{formatCurrency(pb.planned)}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Zaplaceno', value: pb.paid, color: 'bg-green-500' },
                    { label: 'Fakturováno', value: pb.invoiced, color: 'bg-orange-400' },
                    { label: 'Čeká', value: pb.planned - pb.paid - pb.invoiced, color: 'bg-gray-200' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 w-24">{item.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color}`}
                          style={{ width: `${pb.planned > 0 ? Math.min((item.value / pb.planned) * 100, 100) : 0}%` }} />
                      </div>
                      <span className="text-gray-600 text-right w-28">{formatCurrency(Math.max(item.value, 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Cashflow Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Detailní přehled nákladů úkolů</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 font-medium text-gray-500">Úkol</th>
                <th className="text-left py-2 font-medium text-gray-500">Projekt</th>
                <th className="text-left py-2 font-medium text-gray-500">Plánovaný konec</th>
                <th className="text-right py-2 font-medium text-gray-500">Náklady</th>
                <th className="text-left py-2 font-medium text-gray-500">Stav platby</th>
                <th className="text-left py-2 font-medium text-gray-500">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => {
                const project = projects.find(p => p.id === task.projectId);
                return (
                  <tr key={task.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-700">{task.name}</td>
                    <td className="py-2 text-gray-500 text-xs">{project?.name}</td>
                    <td className="py-2 text-gray-500">{formatDate(task.plannedEnd)}</td>
                    <td className="py-2 text-right font-medium text-gray-800">
                      {formatCurrency(task.plannedCost || 0)}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(task.paymentStatus || 'pending')}`}>
                        {statusLabel(task.paymentStatus || 'pending')}
                      </span>
                    </td>
                    <td className="py-2">
                      <select
                        value={task.paymentStatus || 'pending'}
                        onChange={e => updateTask(task.id, { paymentStatus: e.target.value as Task['paymentStatus'] })}
                        className="text-xs border border-gray-200 rounded px-2 py-1"
                      >
                        <option value="pending">Čeká</option>
                        <option value="invoiced">Fakturováno</option>
                        <option value="paid">Zaplaceno</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filteredTasks.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Žádné náklady</td></tr>
              )}
            </tbody>
            {filteredTasks.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={3} className="py-2 font-semibold text-gray-700">Celkem</td>
                  <td className="py-2 text-right font-bold text-gray-800">{formatCurrency(totalPlanned)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
