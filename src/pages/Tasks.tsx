import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { formatDate, statusColor, statusLabel, priorityColor, generateId, nextWorkday, addWorkdays, countWorkdays, getEffectiveProgress } from '../utils/helpers';
import { Plus, Trash2, CheckSquare, Filter, Link2, X, ArrowRight, AlertCircle, Save, AlertTriangle, Clock, CheckCircle, TrendingUp, Search, GripVertical, CalendarDays } from 'lucide-react';
import type { Task, Priority, TaskStatus, Dependency, DependencyType } from '../types';

const DEP_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'FS – Konec → Start',
  SS: 'SS – Start → Start',
  FF: 'FF – Konec → Konec',
};

const DEP_TYPE_SHORT: Record<DependencyType, string> = {
  FS: 'Konec→Start',
  SS: 'Start→Start',
  FF: 'Konec→Konec',
};

const priorityLabels: Record<Priority, string> = {
  low: 'Nízká',
  medium: 'Střední',
  high: 'Vysoká',
  critical: 'Kritická',
};

export default function Tasks() {
  const {
    tasks, projects, crafts, contractors, users, phases, objects, currentProjectId,
    addTask, updateTask, deleteTask, projectCraftAssignments, taskOrder, setTaskOrder,
  } = useAppStore();

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCraft, setFilterCraft] = useState('all');
  const [filterProject, setFilterProject] = useState(currentProjectId || 'all');
  const [searchText, setSearchText] = useState('');
  const [sortCol, setSortCol] = useState<'name' | 'plannedStart' | 'plannedEnd' | 'status' | 'priority' | 'progressPercent'>('plannedStart');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ─── Manual sort / drag-and-drop ───
  const [manualSort, setManualSort] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ─── Side panel ───
  const [panelMode, setPanelMode] = useState<'edit' | 'add' | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<Omit<Task, 'id'> & { id?: string }>({} as Task);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ─── Predecessor form row state ───
  const [newPredTaskId, setNewPredTaskId] = useState('');
  const [newPredType, setNewPredType] = useState<DependencyType>('FS');
  const [newPredLag, setNewPredLag] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  const emptyTask = useCallback((): Omit<Task, 'id'> => ({
    name: '',
    description: '',
    projectId: filterProject !== 'all' ? filterProject : (projects[0]?.id || ''),
    phaseId: '',
    objectId: '',
    plannedStart: today,
    plannedEnd: today,
    plannedDuration: 1,
    predecessors: [],
    successors: [],
    craftId: '',
    contractorId: '',
    responsiblePersonId: users[0]?.id || '',
    priority: 'medium',
    progressPercent: 0,
    autoProgress: true,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 0,
    paymentStatus: 'pending',
  }), [filterProject, projects, users, today]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ─── Filters + Sort ───
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusOrder: Record<string, number> = { delayed: 0, at_risk: 1, in_progress: 2, not_started: 3, completed: 4 };
  const filteredTasks = tasks.filter(t => {
    if (filterProject !== 'all' && t.projectId !== filterProject) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterCraft !== 'all' && t.craftId !== filterCraft) return false;
    if (searchText.trim() && !t.name.toLowerCase().includes(searchText.trim().toLowerCase())) return false;
    return true;
  });

  // Manual mode: sort by persisted taskOrder; Date mode: sort by column
  const visibleTasks = manualSort
    ? [...filteredTasks].sort((a, b) => {
        const ai = taskOrder.indexOf(a.id);
        const bi = taskOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : [...filteredTasks].sort((a, b) => {
        let cmp = 0;
        if (sortCol === 'priority') cmp = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        else if (sortCol === 'status') cmp = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        else if (sortCol === 'progressPercent') cmp = a.progressPercent - b.progressPercent;
        else cmp = String(a[sortCol]).localeCompare(String(b[sortCol]));
        return sortDir === 'asc' ? cmp : -cmp;
      });

  // ─── Drag-and-drop handlers ───
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image so it doesn't obscure the row indicator
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, 20, 20);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    // Reorder within the visible list
    const newVisible = [...visibleTasks];
    const [moved] = newVisible.splice(dragIdx, 1);
    newVisible.splice(targetIdx, 0, moved);

    // Rebuild full taskOrder: replace positions held by visible tasks with new order
    const newOrder = [...taskOrder];
    const visibleIds = visibleTasks.map(t => t.id);
    const positions = visibleIds.map(id => {
      const pos = newOrder.indexOf(id);
      return pos === -1 ? newOrder.length : pos; // append new tasks at end
    }).sort((a, b) => a - b);

    // Fill those positions with newVisible order
    newVisible.forEach((task, i) => {
      if (positions[i] < newOrder.length) {
        newOrder[positions[i]] = task.id;
      } else {
        newOrder.push(task.id);
      }
    });

    setTaskOrder(newOrder);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // ─── Stats ───
  const allProjectTasks = filterProject !== 'all' ? tasks.filter(t => t.projectId === filterProject) : tasks;
  const statsCompleted = allProjectTasks.filter(t => t.status === 'completed').length;

  const statsDelayed = allProjectTasks.filter(t => t.status === 'delayed' || (t.plannedEnd < today && t.status !== 'completed')).length;
  const statsAvgProgress = allProjectTasks.length
    ? Math.round(allProjectTasks.reduce((s, t) => s + getEffectiveProgress(t, today), 0) / allProjectTasks.length)
    : 0;

  const openAdd = useCallback(() => {
    setEditingTask(null);
    setForm(emptyTask());
    setNewPredTaskId('');
    setNewPredType('FS');
    setNewPredLag(0);
    setDeleteConfirm(false);
    setPanelMode('add');
  }, [emptyTask]);

  const openEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setForm({ ...task });
    setNewPredTaskId('');
    setNewPredType('FS');
    setNewPredLag(0);
    setDeleteConfirm(false);
    setPanelMode('edit');
  }, []);

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setDeleteConfirm(false);
  }, []);

  const handleSave = () => {
    if (!form.name?.trim()) return;
    if (panelMode === 'edit' && editingTask) {
      updateTask(editingTask.id, form);
    } else {
      addTask({ ...form, id: generateId() } as Task);
    }
    closePanel();
  };

  const handleDelete = () => {
    if (editingTask) {
      deleteTask(editingTask.id);
      closePanel();
    }
  };

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
      if (e.key === 'n' && !panelOpen && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanel, openAdd, panelMode]);

  const getProjectPhases = (projectId: string) => phases.filter(ph => ph.projectId === projectId);
  const getProjectObjects = (projectId: string) => objects.filter(o => o.projectId === projectId);

  const availablePredecessors = tasks.filter(t => {
    if (editingTask && t.id === editingTask.id) return false;
    if (t.projectId !== form.projectId) return false;
    if ((form.predecessors ?? []).some(p => p.taskId === t.id)) return false;
    return true;
  });

  const addPredecessor = () => {
    if (!newPredTaskId) return;
    const predTask = tasks.find(t => t.id === newPredTaskId);
    if (!predTask) return;

    const newDep: Dependency = { taskId: newPredTaskId, type: newPredType, lag: newPredLag };

    let newStart = form.plannedStart;
    let newEnd = form.plannedEnd;
    const duration = Math.max(0, Math.round(
      (new Date(form.plannedEnd).getTime() - new Date(form.plannedStart).getTime()) / 86400000
    ));

    if (newPredType === 'FS') {
      // Successor starts the day AFTER predecessor finishes (+ lag); never on the same day
      newStart = nextWorkday(addDaysLocal(predTask.plannedEnd, newPredLag + 1));
      newEnd = nextWorkday(addDaysLocal(newStart, duration));
    } else if (newPredType === 'SS') {
      newStart = nextWorkday(addDaysLocal(predTask.plannedStart, newPredLag));
      newEnd = nextWorkday(addDaysLocal(newStart, duration));
    } else if (newPredType === 'FF') {
      newEnd = nextWorkday(addDaysLocal(predTask.plannedEnd, newPredLag));
      newStart = nextWorkday(addDaysLocal(newEnd, -duration));
    }

    setForm(f => ({ ...f, predecessors: [...(f.predecessors ?? []), newDep], plannedStart: newStart, plannedEnd: newEnd }));
    setNewPredTaskId('');
    setNewPredType('FS');
    setNewPredLag(0);
  };

  const removePredecessor = (taskId: string) => {
    setForm(f => ({ ...f, predecessors: (f.predecessors ?? []).filter(p => p.taskId !== taskId) }));
  };

  const panelOpen = panelMode !== null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Backdrop */}
      {panelOpen && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={closePanel} />
      )}

      <div className="space-y-4">
        {/* ─── Stats cards ─── */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <CheckSquare size={18} className="text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800 leading-none">{allProjectTasks.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Celkem úkolů</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 leading-none">{statsCompleted}</p>
              <p className="text-xs text-gray-400 mt-0.5">Dokončeno</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Clock size={18} className="text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-500 leading-none">{statsDelayed}</p>
              <p className="text-xs text-gray-400 mt-0.5">Zpožděno</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600 leading-none">{statsAvgProgress}%</p>
              <p className="text-xs text-gray-400 mt-0.5">Průměrný postup</p>
            </div>
          </div>
        </div>

        {/* ─── Filters + Add ─── */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter size={15} className="text-gray-400 shrink-0" />
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="all">Všechny projekty</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="all">Všechny stavy</option>
              <option value="not_started">Nezahájeno</option>
              <option value="in_progress">Probíhá</option>
              <option value="completed">Dokončeno</option>
              <option value="delayed">Zpožděno</option>
              <option value="at_risk">Riziko</option>
            </select>
            <select
              value={filterCraft}
              onChange={e => setFilterCraft(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="all">Všechna řemesla</option>
              {crafts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 ml-1">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Hledat úkol..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="text-sm outline-none bg-transparent w-32"
              />
              {searchText && <button onClick={() => setSearchText('')} className="text-gray-300 hover:text-gray-500 text-xs">×</button>}
            </div>
            <span className="text-sm text-gray-400 ml-1">{visibleTasks.length} úkolů</span>

            {/* Manual / Date sort toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 ml-1">
              <button
                onClick={() => setManualSort(false)}
                title="Řadit dle data zahájení"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !manualSort ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CalendarDays size={13} /> Dle data
              </button>
              <button
                onClick={() => setManualSort(true)}
                title="Ručně přesouvat pořadí táhnutím"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  manualSort ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <GripVertical size={13} /> Ručně řadit
              </button>
            </div>

            <div className="flex-1" />
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={15} /> Přidat úkol (N)
            </button>
          </div>
        </div>

        {/* ─── Task Table ─── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {/* Drag handle column – visible only in manual mode */}
                  <th className={`py-3 w-8 ${manualSort ? 'px-2' : 'px-0 w-0 opacity-0'}`} />
                  <th className="px-4 py-3 w-8" />
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs w-8">#</th>
                  {([
                    ['name', 'Název úkolu'],
                    [null, 'Projekt / Objekt'],
                    [null, 'Řemeslo'],
                    [null, 'Navazuje na'],
                    ['plannedStart', 'Zahájení'],
                    ['plannedEnd', 'Dokončení'],
                    ['priority', 'Priorita'],
                    ['progressPercent', 'Postup'],
                    ['status', 'Stav'],
                  ] as [string | null, string][]).map(([col, label]) => (
                    <th key={label} className="text-left px-4 py-3 font-medium text-gray-500 text-xs">
                      {col && !manualSort ? (
                        <button
                          className="flex items-center gap-1 hover:text-gray-700"
                          onClick={() => toggleSort(col as typeof sortCol)}
                        >
                          {label}
                          <span className="text-gray-300">{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </button>
                      ) : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleTasks.map((task, idx) => {
                  const project = projects.find(p => p.id === task.projectId);
                  const craft = crafts.find(c => c.id === task.craftId);
                  const obj = objects.find(o => o.id === task.objectId);
                  const isOverdue = task.plannedEnd < today && task.status !== 'completed';
                  const preds = task.predecessors ?? [];
                  const isActive = editingTask?.id === task.id && panelOpen;
                  const isDragging = dragIdx === idx;
                  const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;

                  return (
                    <tr
                      key={task.id}
                      draggable={manualSort}
                      onDragStart={manualSort ? (e) => handleDragStart(e, idx) : undefined}
                      onDragOver={manualSort ? (e) => handleDragOver(e, idx) : undefined}
                      onDrop={manualSort ? (e) => handleDrop(e, idx) : undefined}
                      onDragEnd={manualSort ? handleDragEnd : undefined}
                      onClick={() => openEdit(task)}
                      className={`cursor-pointer transition-colors ${
                        isDragging
                          ? 'opacity-40 bg-blue-50'
                          : isDragOver
                          ? 'border-t-2 border-t-blue-500 bg-blue-50/30'
                          : isActive
                          ? 'bg-blue-50 border-l-2 border-l-blue-500'
                          : isOverdue
                          ? 'bg-red-50/30 hover:bg-red-50/60'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Drag handle */}
                      <td
                        className={`py-3 text-gray-300 transition-all ${manualSort ? 'px-2' : 'px-0 w-0 overflow-hidden'}`}
                        onClick={e => e.stopPropagation()}
                      >
                        {manualSort && (
                          <GripVertical size={16} className="cursor-grab active:cursor-grabbing hover:text-gray-500" />
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          title={task.status === 'completed' ? 'Označit jako nezahájeno' : 'Označit jako dokončeno'}
                          onClick={() => updateTask(task.id, {
                            status: task.status === 'completed' ? 'not_started' : 'completed',
                            progressPercent: task.status === 'completed' ? 0 : 100,
                          })}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            task.status === 'completed'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {task.status === 'completed' && <span className="text-xs leading-none">✓</span>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {task.isCritical && <span className="text-red-500 text-xs">⚡</span>}
                          <span className={`font-medium text-sm ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                            {task.name}
                          </span>
                        </div>
                        {task.notes && <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{task.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 text-xs font-medium">{project?.name}</p>
                        {obj && <p className="text-gray-400 text-xs">{obj.name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {craft && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: craft.color }}>
                            {craft.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {preds.length > 0 ? (
                          <div className="space-y-1">
                            {preds.map(dep => {
                              const predTask = tasks.find(t => t.id === dep.taskId);
                              return predTask ? (
                                <div key={dep.taskId} className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 max-w-[160px]">
                                  <Link2 size={10} className="shrink-0" />
                                  <span className="truncate">{predTask.name}</span>
                                  <span className="shrink-0 text-blue-400 font-medium">{dep.type}</span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(task.plannedStart)}</td>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {formatDate(task.plannedEnd)}
                        {isOverdue && <span className="ml-1 text-red-400">⚠</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(task.priority)}`}>
                          {priorityLabels[task.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const pct = getEffectiveProgress(task, today);
                          const isAuto = task.autoProgress !== false;
                          return (
                            <div className="flex items-center gap-2 min-w-[80px]">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                              {isAuto && <span className="text-[9px] text-blue-400 font-medium leading-none" title="Automatický postup dle termínů">auto</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(task.status)}`}>
                          {statusLabel(task.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleTasks.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <CheckSquare size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium">Žádné úkoly nenalezeny</p>
                <p className="text-sm mt-1">Zkuste upravit filtry nebo přidejte nový úkol</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── SIDE PANEL ─── */}
      <div
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 500,
          backgroundColor: 'white',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {panelOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-gray-800">
                  {panelMode === 'add' ? 'Nový úkol' : 'Upravit úkol'}
                </h2>
                {panelMode === 'edit' && editingTask && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{editingTask.name}</p>
                )}
              </div>
              <button onClick={closePanel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Name + Description */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Název úkolu *</label>
                  <input
                    type="text"
                    autoFocus
                    value={form.name || ''}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Název úkolu..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Popis</label>
                  <textarea
                    value={form.description || ''}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Volitelný popis..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                  />
                </div>
              </div>

              {/* Status + Priority + Progress */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stav</label>
                    <select
                      value={form.status || 'not_started'}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
                      className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="not_started">Nezahájeno</option>
                      <option value="in_progress">Probíhá</option>
                      <option value="completed">Dokončeno</option>
                      <option value="delayed">Zpožděno</option>
                      <option value="at_risk">Riziko</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Priorita</label>
                    <select
                      value={form.priority || 'medium'}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                      className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="low">Nízká</option>
                      <option value="medium">Střední</option>
                      <option value="high">Vysoká</option>
                      <option value="critical">Kritická</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Postup</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Auto</span>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, autoProgress: !(f.autoProgress ?? true) }))}
                        className={`relative w-9 h-5 rounded-full transition-colors ${(form.autoProgress ?? true) ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(form.autoProgress ?? true) ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-sm font-bold text-blue-600">
                        {(form.autoProgress ?? true)
                          ? `${getEffectiveProgress({ ...form as Parameters<typeof getEffectiveProgress>[0] }, today)}%`
                          : `${form.progressPercent ?? 0}%`}
                      </span>
                    </div>
                  </div>
                  {(form.autoProgress ?? true) ? (
                    <div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${getEffectiveProgress({ ...form as Parameters<typeof getEffectiveProgress>[0] }, today)}%` }} />
                      </div>
                      <p className="text-xs text-blue-500 mt-1">Počítá se automaticky z termínů úkolu</p>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="range" min={0} max={100} step={5}
                        value={form.progressPercent ?? 0}
                        onChange={e => setForm(f => ({ ...f, progressPercent: Number(e.target.value) }))}
                        className="w-full accent-blue-600"
                      />
                      <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${form.progressPercent ?? 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Project + Phase + Object */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Zařazení</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Projekt</label>
                    <select
                      value={form.projectId || ''}
                      onChange={e => setForm(f => ({ ...f, projectId: e.target.value, phaseId: '', objectId: '', predecessors: [] }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Fáze</label>
                    <select
                      value={form.phaseId || ''}
                      onChange={e => setForm(f => ({ ...f, phaseId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">— bez fáze —</option>
                      {getProjectPhases(form.projectId || '').map(ph => (
                        <option key={ph.id} value={ph.id}>{ph.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Objekt</label>
                    <select
                      value={form.objectId || ''}
                      onChange={e => setForm(f => ({ ...f, objectId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">— bez objektu —</option>
                      {getProjectObjects(form.projectId || '').map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Řemeslo</label>
                    <select
                      value={form.craftId || ''}
                      onChange={e => {
                        const craftId = e.target.value;
                        const craft = crafts.find(c => c.id === craftId);
                        // Project-specific assignment takes priority over craft default
                        const assignment = projectCraftAssignments.find(
                          a => a.projectId === form.projectId && a.craftId === craftId
                        );
                        const contractorId = assignment?.contractorId || craft?.contractorId || '';
                        setForm(f => ({ ...f, craftId, contractorId }));
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">— bez řemesla —</option>
                      {crafts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Zhotovitel</label>
                    <select
                      value={form.contractorId || ''}
                      onChange={e => setForm(f => ({ ...f, contractorId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">— bez zhotovitele —</option>
                      {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Odpovědná osoba</label>
                    <select
                      value={form.responsiblePersonId || ''}
                      onChange={e => setForm(f => ({ ...f, responsiblePersonId: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">— nevybráno —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dates + Duration */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Zahájení
                    {(form.predecessors?.length ?? 0) > 0 && <span className="ml-1 text-blue-400 font-normal normal-case">(z vazby)</span>}
                  </label>
                  <input
                    type="date"
                    value={form.plannedStart || ''}
                    onChange={e => {
                      const start = nextWorkday(e.target.value);
                      const dur = form.plannedDuration ?? 1;
                      const end = addWorkdays(start, dur - 1);
                      setForm(f => ({ ...f, plannedStart: start, plannedEnd: end }));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Počet prac. dnů
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.plannedDuration ?? 1}
                    onChange={e => {
                      const dur = Math.max(1, parseInt(e.target.value) || 1);
                      const end = addWorkdays(form.plannedStart || today, dur - 1);
                      setForm(f => ({ ...f, plannedDuration: dur, plannedEnd: end }));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dokončení</label>
                  <input
                    type="date"
                    value={form.plannedEnd || ''}
                    onChange={e => {
                      const end = nextWorkday(e.target.value);
                      const dur = countWorkdays(form.plannedStart || today, end);
                      setForm(f => ({ ...f, plannedEnd: end, plannedDuration: dur }));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Predecessors */}
              <div className="border border-blue-100 rounded-xl bg-blue-50/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 size={14} className="text-blue-500" />
                  <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Vazby na předchůdce</h3>
                </div>

                {(form.predecessors?.length ?? 0) > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {(form.predecessors ?? []).map(dep => {
                      const predTask = tasks.find(t => t.id === dep.taskId);
                      return (
                        <div key={dep.taskId} className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
                          <ArrowRight size={12} className="text-blue-400 shrink-0" />
                          <span className="text-xs font-medium text-gray-700 flex-1 truncate">{predTask?.name ?? dep.taskId}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">{dep.type}</span>
                          <span className="text-xs text-gray-400 shrink-0">{DEP_TYPE_SHORT[dep.type]}</span>
                          {(dep.lag ?? 0) !== 0 && (
                            <span className="text-xs text-orange-500 shrink-0">{dep.lag! > 0 ? `+${dep.lag}d` : `${dep.lag}d`}</span>
                          )}
                          <button onClick={() => removePredecessor(dep.taskId)} className="text-gray-300 hover:text-red-400 shrink-0">
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {availablePredecessors.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newPredTaskId}
                        onChange={e => setNewPredTaskId(e.target.value)}
                        className="border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs outline-none col-span-2"
                      >
                        <option value="">— vyberte předchůdce —</option>
                        {availablePredecessors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <select
                        value={newPredType}
                        onChange={e => setNewPredType(e.target.value as DependencyType)}
                        className="border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs outline-none"
                      >
                        {(Object.keys(DEP_TYPE_LABELS) as DependencyType[]).map(k => (
                          <option key={k} value={k}>{DEP_TYPE_LABELS[k]}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={newPredLag}
                        onChange={e => setNewPredLag(Number(e.target.value))}
                        placeholder="Posun (dny)"
                        className="border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                    <button
                      onClick={addPredecessor}
                      disabled={!newPredTaskId}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-40"
                    >
                      <Plus size={12} /> Přidat vazbu
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Žádné dostupné úkoly pro přidání vazby.</p>
                )}

                {(form.predecessors?.length ?? 0) > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-blue-600 bg-blue-100 rounded-lg px-2.5 py-2">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    Termíny se po uložení automaticky přepočítají.
                  </div>
                )}
              </div>

              {/* Cost + Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Náklady (Kč)</label>
                  <input
                    type="number"
                    value={form.plannedCost || 0}
                    onChange={e => setForm(f => ({ ...f, plannedCost: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stav platby</label>
                  <select
                    value={form.paymentStatus || 'pending'}
                    onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value as Task['paymentStatus'] }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="pending">Čeká</option>
                    <option value="invoiced">Fakturováno</option>
                    <option value="paid">Zaplaceno</option>
                  </select>
                </div>
              </div>

              {/* Critical + Notes */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setForm(f => ({ ...f, isCritical: !f.isCritical }))}
                    className={`w-10 h-5 rounded-full transition-colors shrink-0 ${form.isCritical ? 'bg-red-500' : 'bg-gray-200'}`}
                    style={{ position: 'relative' }}
                  >
                    <span style={{
                      position: 'absolute', top: 2,
                      left: form.isCritical ? 22 : 2,
                      width: 16, height: 16, borderRadius: '50%', backgroundColor: 'white',
                      transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                  <span className="text-sm text-gray-700">Kritická cesta</span>
                  {form.isCritical && <span className="text-xs text-red-500">⚡</span>}
                </label>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Poznámky</label>
                  <textarea
                    value={form.notes || ''}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    placeholder="Volitelné poznámky..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                  />
                </div>
              </div>

              {/* Delete confirm inline */}
              {deleteConfirm && panelMode === 'edit' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-red-700">
                    <AlertTriangle size={15} />
                    <span className="text-sm font-medium">Opravdu smazat úkol?</span>
                  </div>
                  <p className="text-xs text-red-500 mb-3">Tato akce je nevratná.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirm(false)} className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs hover:bg-gray-50">Zrušit</button>
                    <button onClick={handleDelete} className="flex-1 bg-red-600 text-white rounded-lg py-1.5 text-xs hover:bg-red-700 font-medium">Smazat</button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center gap-2">
              {panelMode === 'edit' && !deleteConfirm && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Smazat úkol"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <div className="flex-1" />
              <button onClick={closePanel} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100">
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name?.trim()}
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

function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
