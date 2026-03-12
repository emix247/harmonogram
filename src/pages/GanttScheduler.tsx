import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { formatDate, statusColor, statusLabel, generateId, nextWorkday } from '../utils/helpers';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Save, AlertTriangle, Search } from 'lucide-react';
import type { Task, TaskStatus, Priority } from '../types';

type ZoomLevel = 'week' | 'month' | 'quarter';

function getDaysArray(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function getWeeksArray(start: Date, end: Date): { start: Date; end: Date; label: string }[] {
  const weeks: { start: Date; end: Date; label: string }[] = [];
  const current = new Date(start);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  while (current <= end) {
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({ start: new Date(current), end: new Date(weekEnd), label: `T${getWeekNumber(current)}` });
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMonthsArray(start: Date, end: Date): { year: number; month: number; label: string; days: number }[] {
  const months: { year: number; month: number; label: string; days: number }[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    months.push({
      year: current.getFullYear(),
      month: current.getMonth(),
      label: current.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' }),
      days: daysInMonth,
    });
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Nezahájeno', color: 'bg-gray-100 text-gray-700' },
  { value: 'in_progress', label: 'Probíhá', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Dokončeno', color: 'bg-green-100 text-green-700' },
  { value: 'delayed', label: 'Zpožděno', color: 'bg-red-100 text-red-700' },
  { value: 'at_risk', label: 'Ohroženo', color: 'bg-amber-100 text-amber-700' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Nízká' },
  { value: 'medium', label: 'Střední' },
  { value: 'high', label: 'Vysoká' },
  { value: 'critical', label: 'Kritická' },
];

interface GanttSchedulerProps {
  lockedProjectId?: string;
  hideToolbar?: boolean;
}

export default function GanttScheduler({ lockedProjectId, hideToolbar }: GanttSchedulerProps = {}) {
  const {
    tasks, projects, phases, currentProjectId, milestones, crafts, objects, users,
    addTask, updateTask, deleteTask, taskOrder,
  } = useAppStore();

  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [filterProject, setFilterProject] = useState(
    lockedProjectId ?? (currentProjectId || projects[0]?.id || '')
  );
  const [searchText, setSearchText] = useState('');
  const [offset, setOffset] = useState(0);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // ─── Side panel state ───
  const [panelMode, setPanelMode] = useState<'edit' | 'add' | null>(null);
  const [panelForm, setPanelForm] = useState<Omit<Task, 'id'> & { id?: string }>({} as Task);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const filteredTasks = tasks.filter(t => {
    if (filterProject && t.projectId !== filterProject) return false;
    if (searchText.trim() && !t.name.toLowerCase().includes(searchText.trim().toLowerCase())) return false;
    return true;
  });

  const filteredMilestones = milestones.filter(m =>
    filterProject ? m.projectId === filterProject : true
  );

  const allDates = filteredTasks.flatMap(t => [new Date(t.plannedStart), new Date(t.plannedEnd)]);
  filteredMilestones.forEach(m => allDates.push(new Date(m.plannedDate)));

  const baseStart = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const baseEnd = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date(today.getFullYear(), today.getMonth() + 3, 0);

  baseStart.setDate(baseStart.getDate() - 7 + offset * 7);
  baseEnd.setDate(baseEnd.getDate() + 14 + offset * 7);

  const days = getDaysArray(baseStart, baseEnd);
  const weeks = getWeeksArray(baseStart, baseEnd);
  const months = getMonthsArray(baseStart, baseEnd);

  const totalDays = days.length;
  const DAY_WIDTH = zoom === 'week' ? 40 : zoom === 'month' ? 20 : 8;
  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = zoom === 'month' ? 60 : 40;
  const LABEL_WIDTH = 280;
  const totalGanttWidth = LABEL_WIDTH + totalDays * DAY_WIDTH;

  const dateToX = (dateStr: string): number => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - baseStart.getTime()) / 86400000) * DAY_WIDTH;
  };

  const taskWidth = (start: string, end: string): number => {
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
    return Math.max(diff * DAY_WIDTH, DAY_WIDTH);
  };

  const todayX = Math.round((today.getTime() - baseStart.getTime()) / 86400000) * DAY_WIDTH;

  const getTaskColor = (task: (typeof tasks)[0]) => {
    if (task.status === 'completed') return '#10b981';
    if (task.isCritical) return '#ef4444';
    if (task.status === 'in_progress') return '#3b82f6';
    if (task.status === 'delayed') return '#f97316';
    if (task.status === 'at_risk') return '#f59e0b';
    return '#94a3b8';
  };

  // Sort helper: respects persisted taskOrder from Tasks page
  const sortByTaskOrder = (a: (typeof tasks)[0], b: (typeof tasks)[0]) => {
    const ai = taskOrder.indexOf(a.id);
    const bi = taskOrder.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  };

  // Flat list sorted by taskOrder — identical ordering to the Tasks page
  const orderedTasks = [...filteredTasks].sort(sortByTaskOrder);

  // ─── Panel helpers ───
  const openEdit = useCallback((task: Task) => {
    if (lockedProjectId) return; // read-only
    setPanelForm({ ...task });
    setPanelMode('edit');
    setDeleteConfirm(false);
  }, [lockedProjectId]);

  const openAdd = useCallback(() => {
    const projId = filterProject || projects[0]?.id || '';
    setPanelForm({
      name: '',
      description: '',
      projectId: projId,
      phaseId: '',
      objectId: '',
      plannedStart: todayStr,
      plannedEnd: todayStr,
      plannedDuration: 1,
      predecessors: [],
      successors: [],
      craftId: '',
      contractorId: '',
      responsiblePersonId: users[0]?.id || '',
      priority: 'high',
      progressPercent: 0,
      status: 'not_started',
      notes: '',
      attachments: [],
      isCritical: false,
      plannedCost: 0,
      paymentStatus: 'pending',
    });
    setPanelMode('add');
    setDeleteConfirm(false);
  }, [filterProject, projects, users, todayStr]);

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setDeleteConfirm(false);
  }, []);

  const handleSave = () => {
    if (!panelForm.name?.trim()) return;
    if (panelMode === 'edit' && panelForm.id) {
      updateTask(panelForm.id, panelForm);
    } else if (panelMode === 'add') {
      addTask({ ...panelForm, id: generateId() } as Task);
    }
    closePanel();
  };

  const handleDelete = () => {
    if (panelForm.id) {
      deleteTask(panelForm.id);
      closePanel();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
      if (e.key === 'n' && panelMode === null && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanel, openAdd, panelMode]);

  const projectPhases = phases.filter(ph => ph.projectId === panelForm.projectId);
  const projectObjects = objects.filter(o => o.projectId === panelForm.projectId);
  const panelStatusInfo = STATUS_OPTIONS.find(s => s.value === panelForm.status) ?? STATUS_OPTIONS[0];

  const panelOpen = panelMode !== null;

  return (
    <div className="space-y-4" style={{ position: 'relative' }}>
      {/* Backdrop */}
      {panelOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={closePanel}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        {!hideToolbar && (
          <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-gray-50 flex-wrap">
            {!lockedProjectId && (
              <select
                value={filterProject}
                onChange={e => { setFilterProject(e.target.value); setSearchText(''); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Hledat úkol..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="text-xs outline-none w-28"
              />
              {searchText && (
                <button onClick={() => setSearchText('')} className="text-gray-300 hover:text-gray-500">×</button>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2">
              <span className="text-sm text-gray-500 mr-2">Přiblížení:</span>
              {(['week', 'month', 'quarter'] as ZoomLevel[]).map(z => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`px-3 py-1 rounded text-xs font-medium ${zoom === z ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {z === 'week' ? 'Týdny' : z === 'month' ? 'Měsíce' : 'Čtvrtletí'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              {!lockedProjectId && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 mr-2"
                >
                  <Plus size={14} /> Přidat úkol (N)
                </button>
              )}
              <button onClick={() => setOffset(o => o - 4)} className="p-1.5 border border-gray-200 rounded hover:bg-gray-100">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setOffset(0)} className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100">
                Dnes
              </button>
              <button onClick={() => setOffset(o => o + 4)} className="p-1.5 border border-gray-200 rounded hover:bg-gray-100">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 px-4 py-2 border-b border-gray-100 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Dokončeno</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Probíhá</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Kritická cesta</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Zpožděno</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-400 inline-block" /> Nezahájeno</span>
          <span className="flex items-center gap-1"><span className="w-0.5 h-4 bg-red-600 inline-block" /> Dnes</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Milník</span>
          {!lockedProjectId && <span className="ml-auto text-gray-400 italic">Kliknutím na úkol otevřete editaci</span>}
        </div>

        {/* Gantt Chart */}
        <div className="overflow-auto" style={{ maxHeight: '55vh' }}>
          <div style={{ display: 'flex', width: totalGanttWidth }}>
            {/* Left labels — sticky so they stay visible on horizontal scroll */}
            <div style={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'white' }}>
              <div
                style={{ height: HEADER_HEIGHT, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}
                className="flex items-end pb-2 px-3"
              >
                <span className="text-xs font-medium text-gray-500">Název úkolu</span>
              </div>
              {orderedTasks.map(task => {
                const taskPhase = task.phaseId ? phases.find(ph => ph.id === task.phaseId) : undefined;
                return (
                  <div
                    key={task.id}
                    style={{
                      height: ROW_HEIGHT,
                      borderBottom: '1px solid #f1f5f9',
                      borderLeft: taskPhase ? `4px solid ${taskPhase.color}` : '4px solid transparent',
                      backgroundColor: hoveredTaskId === task.id ? '#eff6ff' : undefined,
                      transition: 'background-color 0.1s',
                      cursor: lockedProjectId ? 'default' : 'pointer',
                    }}
                    className="flex items-center px-3 gap-1.5 group"
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onClick={() => openEdit(task)}
                  >
                    {task.isCritical && <span className="text-red-500 text-xs">⚡</span>}
                    <span className="text-xs text-gray-700 truncate flex-1" title={task.name}>{task.name}</span>
                    {!lockedProjectId && (
                      <span className="text-gray-300 group-hover:text-blue-400 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Timeline */}
            <div style={{ width: totalDays * DAY_WIDTH, flexShrink: 0, position: 'relative' }}>
                {/* Header */}
                <div style={{ height: HEADER_HEIGHT, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 10 }}>
                  {zoom === 'week' && (
                    <div style={{ display: 'flex', height: '100%' }}>
                      {days.map((day, i) => (
                        <div
                          key={i}
                          style={{
                            width: DAY_WIDTH, flexShrink: 0, borderRight: '1px solid #e5e7eb',
                            backgroundColor: day.getDay() === 0 || day.getDay() === 6 ? '#fef9c3' : undefined,
                          }}
                          className="flex flex-col items-center justify-center"
                        >
                          <span className="text-xs text-gray-400">{day.toLocaleDateString('cs-CZ', { weekday: 'short' })}</span>
                          <span className="text-xs font-medium text-gray-600">{day.getDate()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {zoom === 'month' && (
                    <div>
                      <div style={{ display: 'flex', height: '50%', borderBottom: '1px solid #e5e7eb' }}>
                        {months.map((m, i) => (
                          <div key={i} style={{ width: m.days * DAY_WIDTH, flexShrink: 0, borderRight: '1px solid #e5e7eb' }} className="flex items-center px-2">
                            <span className="text-xs font-semibold text-gray-700 capitalize">{m.label}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', height: '50%' }}>
                        {weeks.map((w, i) => (
                          <div key={i} style={{ width: 7 * DAY_WIDTH, flexShrink: 0, borderRight: '1px solid #e5e7eb' }} className="flex items-center justify-center">
                            <span className="text-xs text-gray-400">{w.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {zoom === 'quarter' && (
                    <div style={{ display: 'flex', height: '100%' }}>
                      {months.map((m, i) => (
                        <div key={i} style={{ width: m.days * DAY_WIDTH, flexShrink: 0, borderRight: '1px solid #e5e7eb' }} className="flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600 capitalize">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Today line */}
                {todayX >= 0 && todayX <= totalDays * DAY_WIDTH && (
                  <div style={{ position: 'absolute', left: todayX, top: HEADER_HEIGHT, bottom: 0, width: 2, backgroundColor: '#ef4444', zIndex: 5, pointerEvents: 'none' }} />
                )}

                {/* Weekend shading */}
                {zoom === 'week' && days.map((day, i) =>
                  (day.getDay() === 0 || day.getDay() === 6) && (
                    <div key={i} style={{ position: 'absolute', left: i * DAY_WIDTH, top: HEADER_HEIGHT, bottom: 0, width: DAY_WIDTH, backgroundColor: '#fef9c320', pointerEvents: 'none', zIndex: 1 }} />
                  )
                )}

                {/* Task bars — flat list in taskOrder, matching Tasks page exactly */}
                {(() => {
                  const bars: React.ReactNode[] = [];

                  orderedTasks.forEach((task, rowIndex) => {
                    const x = dateToX(task.plannedStart);
                    const w = taskWidth(task.plannedStart, task.plannedEnd);
                    const color = getTaskColor(task);
                    const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
                    const isHovered = hoveredTaskId === task.id;

                    bars.push(
                      <div
                        key={`row-${task.id}`}
                        style={{ position: 'absolute', top: y, left: 0, right: 0, height: ROW_HEIGHT, borderBottom: '1px solid #f1f5f9', backgroundColor: isHovered ? '#eff6ff40' : undefined, transition: 'background-color 0.1s' }}
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() => setHoveredTaskId(null)}
                      />,
                      <div
                        key={`bar-${task.id}`}
                        title={`${task.name}\n${formatDate(task.plannedStart)} – ${formatDate(task.plannedEnd)}\nPostup: ${task.progressPercent}%\nKliknutím editujte`}
                        style={{
                          position: 'absolute',
                          top: y + 6, left: x, width: w, height: ROW_HEIGHT - 12,
                          backgroundColor: color,
                          borderRadius: 4,
                          zIndex: 3,
                          overflow: 'hidden',
                          cursor: lockedProjectId ? 'default' : 'pointer',
                          boxShadow: isHovered ? `0 0 0 2px white, 0 0 0 3px ${color}, 0 2px 8px rgba(0,0,0,0.3)` : '0 1px 3px rgba(0,0,0,0.2)',
                          transform: isHovered ? 'scaleY(1.12)' : undefined,
                          transition: 'box-shadow 0.1s, transform 0.1s',
                        }}
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() => setHoveredTaskId(null)}
                        onClick={() => openEdit(task)}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, width: `${task.progressPercent}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.25)' }} />
                        {w > 60 && (
                          <span className="absolute inset-0 flex items-center px-2 text-white text-xs font-medium truncate">
                            {task.progressPercent}%
                          </span>
                        )}
                      </div>
                    );
                  });

                  // Milestones
                  filteredMilestones.forEach(m => {
                    const x = dateToX(m.plannedDate);
                    bars.push(
                      <div
                        key={`milestone-${m.id}`}
                        title={`Milník: ${m.name}\n${formatDate(m.plannedDate)}`}
                        style={{ position: 'absolute', top: HEADER_HEIGHT + 4, left: x - 8, width: 16, height: 16, backgroundColor: m.color, transform: 'rotate(45deg)', zIndex: 6, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                      />
                    );
                  });

                  return bars;
                })()}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 text-xs text-gray-500 flex gap-4 flex-wrap">
          <span>{filteredTasks.length} úkolů zobrazeno</span>
          <span>Rozsah: {formatDate(baseStart.toISOString())} – {formatDate(baseEnd.toISOString())}</span>
          <span>Dnes: {formatDate(today.toISOString())}</span>
        </div>
      </div>

      {/* ─── TASK LIST TABLE BELOW GANTT ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Seznam úkolů</h3>
          <span className="text-xs text-gray-400">{filteredTasks.length} úkolů{!lockedProjectId && ' · kliknutím na řádek editujete'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs text-gray-500 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                <th className="text-left px-4 py-2.5 font-medium">Název úkolu</th>
                <th className="text-left px-4 py-2.5 font-medium">Fáze</th>
                <th className="text-left px-4 py-2.5 font-medium">Objekt</th>
                <th className="text-left px-4 py-2.5 font-medium">Řemeslo</th>
                <th className="text-left px-4 py-2.5 font-medium">Zahájení</th>
                <th className="text-left px-4 py-2.5 font-medium">Dokončení</th>
                <th className="text-left px-4 py-2.5 font-medium">Trvání</th>
                <th className="text-left px-4 py-2.5 font-medium">Postup</th>
                <th className="text-left px-4 py-2.5 font-medium">Stav</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orderedTasks.map((task, idx) => {
                const phase = phases.find(ph => ph.id === task.phaseId);
                const obj = objects.find(o => o.id === task.objectId);
                const craft = crafts.find(c => c.id === task.craftId);
                const durationDays = Math.round(
                  (new Date(task.plannedEnd).getTime() - new Date(task.plannedStart).getTime()) / 86400000
                ) + 1;
                const isHovered = hoveredTaskId === task.id;
                const today2 = new Date().toISOString().split('T')[0];
                const isOverdue = task.plannedEnd < today2 && task.status !== 'completed';

                return (
                  <tr
                    key={task.id}
                    className={`transition-colors ${lockedProjectId ? 'cursor-default' : 'cursor-pointer'} ${isHovered ? 'bg-blue-50' : isOverdue ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-gray-50'}`}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onClick={() => openEdit(task)}
                  >
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {task.isCritical && <span className="text-red-500 text-xs">⚡</span>}
                        <span className={`font-medium text-xs ${isHovered ? 'text-blue-700' : 'text-gray-800'}`}>{task.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {phase ? (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                          {phase.name}
                        </span>
                      ) : <span className="text-gray-300 text-xs">–</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{obj?.name || <span className="text-gray-300">–</span>}</td>
                    <td className="px-4 py-2.5">
                      {craft ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-xs text-white" style={{ backgroundColor: craft.color }}>
                          {craft.name}
                        </span>
                      ) : <span className="text-gray-300 text-xs">–</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{formatDate(task.plannedStart)}</td>
                    <td className={`px-4 py-2.5 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {formatDate(task.plannedEnd)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{durationDays} dní</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 min-w-[70px]">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${task.progressPercent}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-7 text-right">{task.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(task.status)}`}>
                        {statusLabel(task.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {orderedTasks.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-400 text-sm">Žádné úkoly v tomto projektu</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SIDE PANEL ─── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          backgroundColor: 'white',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {panelOpen && (
          <>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
              <h2 className="text-sm font-bold text-gray-800">
                {panelMode === 'add' ? 'Nový úkol' : 'Upravit úkol'}
              </h2>
              <button onClick={closePanel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Task Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Název úkolu *</label>
                <input
                  type="text"
                  autoFocus
                  value={panelForm.name || ''}
                  onChange={e => setPanelForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Název úkolu..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Status + Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stav</label>
                  <select
                    value={panelForm.status || 'not_started'}
                    onChange={e => setPanelForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Priorita</label>
                  <select
                    value={panelForm.priority || 'medium'}
                    onChange={e => setPanelForm(f => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status badge preview */}
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${panelStatusInfo.color}`}>
                  {panelStatusInfo.label}
                </span>
                {panelForm.isCritical && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
                    ⚡ Kritická cesta
                  </span>
                )}
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Postup</label>
                  <span className="text-sm font-bold text-blue-600">{panelForm.progressPercent ?? 0}%</span>
                </div>
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={panelForm.progressPercent ?? 0}
                  onChange={e => setPanelForm(f => ({ ...f, progressPercent: Number(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
                <div className="mt-1.5 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${panelForm.progressPercent ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Zahájení</label>
                  <input
                    type="date"
                    value={panelForm.plannedStart || ''}
                    onChange={e => setPanelForm(f => ({ ...f, plannedStart: nextWorkday(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dokončení</label>
                  <input
                    type="date"
                    value={panelForm.plannedEnd || ''}
                    onChange={e => setPanelForm(f => ({ ...f, plannedEnd: nextWorkday(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Phase + Object */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Fáze</label>
                  <select
                    value={panelForm.phaseId || ''}
                    onChange={e => setPanelForm(f => ({ ...f, phaseId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="">— bez fáze —</option>
                    {projectPhases.map(ph => (
                      <option key={ph.id} value={ph.id}>{ph.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Objekt</label>
                  <select
                    value={panelForm.objectId || ''}
                    onChange={e => setPanelForm(f => ({ ...f, objectId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="">— bez objektu —</option>
                    {projectObjects.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Craft + Responsible */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Řemeslo</label>
                  <select
                    value={panelForm.craftId || ''}
                    onChange={e => {
                      const craft = crafts.find(c => c.id === e.target.value);
                      setPanelForm(f => ({ ...f, craftId: e.target.value, contractorId: craft?.contractorId || '' }));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="">— bez řemesla —</option>
                    {crafts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Odpovědná osoba</label>
                  <select
                    value={panelForm.responsiblePersonId || ''}
                    onChange={e => setPanelForm(f => ({ ...f, responsiblePersonId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="">— nevybráno —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kritická cesta toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setPanelForm(f => ({ ...f, isCritical: !f.isCritical }))}
                  className={`w-10 h-5 rounded-full transition-colors shrink-0 ${panelForm.isCritical ? 'bg-red-500' : 'bg-gray-200'}`}
                  style={{ position: 'relative' }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: panelForm.isCritical ? 22 : 2,
                    width: 16, height: 16, borderRadius: '50%', backgroundColor: 'white',
                    transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
                <span className="text-sm text-gray-700">Kritická cesta</span>
              </label>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Poznámky</label>
                <textarea
                  value={panelForm.notes || ''}
                  onChange={e => setPanelForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Volitelné poznámky..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                />
              </div>

              {/* Delete confirmation inline */}
              {deleteConfirm && panelMode === 'edit' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-red-700">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-medium">Opravdu smazat úkol?</span>
                  </div>
                  <p className="text-xs text-red-600 mb-3">Tato akce je nevratná.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs hover:bg-gray-50"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 bg-red-600 text-white rounded-lg py-1.5 text-xs hover:bg-red-700 font-medium"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center gap-2">
              {panelMode === 'edit' && !deleteConfirm && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Smazat úkol"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={closePanel}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100"
              >
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={!panelForm.name?.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={14} />
                {panelMode === 'add' ? 'Přidat' : 'Uložit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
