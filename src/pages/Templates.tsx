import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/helpers';
import {
  FileStack, Clock, Copy, Plus, Pencil, Trash2,
  ChevronUp, ChevronDown, X, Save, AlertTriangle
} from 'lucide-react';
import type { Template } from '../types';

// ── Typy ─────────────────────────────────────────────────────────────────────

type TemplateTask = {
  id: string;
  name: string;
  description: string;
  plannedDuration: number;
  craftId: string;
  plannedCost: number;
};

type TemplateForm = {
  name: string;
  description: string;
  category: string;
  color: string;
  estimatedDuration: number;
  tasks: TemplateTask[];
};

// ── Konstanty ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['Rodinný dům', 'Bytový dům', 'Komerční stavba', 'Průmyslová stavba', 'Ostatní'];

const TEMPLATE_COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f97316','#ef4444',
  '#06b6d4','#ec4899','#84cc16','#DEB887','#6b7280',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Rodinný dům': 'bg-blue-100 text-blue-700',
  'Bytový dům': 'bg-purple-100 text-purple-700',
  'Komerční stavba': 'bg-orange-100 text-orange-700',
  'Průmyslová stavba': 'bg-gray-100 text-gray-700',
  'Ostatní': 'bg-green-100 text-green-700',
};

const EMPTY_FORM: TemplateForm = {
  name: '',
  description: '',
  category: 'Rodinný dům',
  color: '#3b82f6',
  estimatedDuration: 0,
  tasks: [],
};

const EMPTY_TASK: TemplateTask = {
  id: '',
  name: '',
  description: '',
  plannedDuration: 7,
  craftId: '',
  plannedCost: 0,
};

// ── Pomocník pro součet délky ─────────────────────────────────────────────────

const sumDuration = (tasks: TemplateTask[]) =>
  tasks.reduce((s, t) => s + (t.plannedDuration || 0), 0);

// ── Komponenta ────────────────────────────────────────────────────────────────

export default function Templates() {
  const { templates, crafts, projects, addTemplate, updateTemplate, deleteTemplate, setCurrentPage, setCurrentProjectId } = useAppStore();

  // Filtrace / pohled
  const [selectedCategory, setSelectedCategory] = useState('');

  // Pohledy – karty nebo editor
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null); // null = nová šablona
  const [editorOpen, setEditorOpen] = useState(false);

  // Detail modal (jen čtení)
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);

  // Aplikovat na projekt
  const [applyModal, setApplyModal] = useState(false);
  const [applyTargetProject, setApplyTargetProject] = useState('');
  const [applyStartDate, setApplyStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [applyTemplate, setApplyTemplate] = useState<Template | null>(null);

  // Formulář editoru
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [taskDraft, setTaskDraft] = useState<TemplateTask>(EMPTY_TASK);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // id šablony ke smazání

  // ── Filtrace karet ──────────────────────────────────────────────────────────

  const filtered = templates.filter(t =>
    selectedCategory ? t.category === selectedCategory : true
  );

  // ── Otevřít editor ──────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ ...EMPTY_FORM, tasks: [] });
    setEditingTaskIndex(null);
    setEditorOpen(true);
  };

  const openEdit = (tmpl: Template) => {
    setEditingTemplate(tmpl);
    setForm({
      name: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      color: tmpl.color,
      estimatedDuration: tmpl.estimatedDuration,
      tasks: tmpl.tasks.map(t => ({
        id: generateId(),
        name: t.name || '',
        description: t.description || '',
        plannedDuration: t.plannedDuration || 7,
        craftId: t.craftId || '',
        plannedCost: t.plannedCost || 0,
      })),
    });
    setEditingTaskIndex(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
    setEditingTaskIndex(null);
  };

  // ── Uložit šablonu ──────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!form.name.trim()) return;
    const total = sumDuration(form.tasks);
    const payload: Template = {
      id: editingTemplate?.id || generateId(),
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      color: form.color,
      estimatedDuration: total || form.estimatedDuration,
      tasks: form.tasks.map(t => ({
        name: t.name,
        description: t.description,
        plannedDuration: t.plannedDuration,
        craftId: t.craftId,
        plannedCost: t.plannedCost || undefined,
      })),
    };
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, payload);
    } else {
      addTemplate(payload);
    }
    closeEditor();
  };

  // ── Smazat šablonu ──────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    setDeleteConfirm(null);
  };

  // ── Správa úkolů v editoru ──────────────────────────────────────────────────

  const startAddTask = () => {
    setTaskDraft({ ...EMPTY_TASK, id: generateId() });
    setEditingTaskIndex(form.tasks.length); // nový – přidá se na konec
  };

  const startEditTask = (idx: number) => {
    setTaskDraft({ ...form.tasks[idx] });
    setEditingTaskIndex(idx);
  };

  const cancelTaskEdit = () => {
    setEditingTaskIndex(null);
    setTaskDraft(EMPTY_TASK);
  };

  const saveTask = () => {
    if (!taskDraft.name.trim()) return;
    const tasks = [...form.tasks];
    if (editingTaskIndex !== null && editingTaskIndex < form.tasks.length) {
      tasks[editingTaskIndex] = { ...taskDraft };
    } else {
      tasks.push({ ...taskDraft, id: taskDraft.id || generateId() });
    }
    setForm(f => ({ ...f, tasks, estimatedDuration: sumDuration(tasks) }));
    cancelTaskEdit();
  };

  const deleteTask = (idx: number) => {
    const tasks = form.tasks.filter((_, i) => i !== idx);
    setForm(f => ({ ...f, tasks, estimatedDuration: sumDuration(tasks) }));
    if (editingTaskIndex === idx) cancelTaskEdit();
  };

  const moveTask = (idx: number, dir: -1 | 1) => {
    const tasks = [...form.tasks];
    const target = idx + dir;
    if (target < 0 || target >= tasks.length) return;
    [tasks[idx], tasks[target]] = [tasks[target], tasks[idx]];
    setForm(f => ({ ...f, tasks }));
    if (editingTaskIndex === idx) setEditingTaskIndex(target);
    else if (editingTaskIndex === target) setEditingTaskIndex(idx);
  };

  // ── Aplikovat šablonu na projekt ───────────────────────────────────────────

  const handleApplyTemplate = () => {
    if (!applyTemplate || !applyTargetProject || !applyStartDate) return;
    const store = useAppStore.getState();
    let currentDate = new Date(applyStartDate);

    const newTasks = applyTemplate.tasks.map((taskTemplate, idx) => {
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + (taskTemplate.plannedDuration || 7));

      const task = {
        id: generateId(),
        name: taskTemplate.name || `Úkol ${idx + 1}`,
        description: taskTemplate.description || '',
        projectId: applyTargetProject,
        phaseId: '',
        objectId: '',
        plannedStart: startDate.toISOString().split('T')[0],
        plannedEnd: endDate.toISOString().split('T')[0],
        plannedDuration: taskTemplate.plannedDuration || 7,
        predecessors: [] as { taskId: string; type: 'FS' | 'SS' | 'FF' }[],
        successors: [] as string[],
        craftId: taskTemplate.craftId || '',
        contractorId: '',
        responsiblePersonId: '',
        priority: 'medium' as const,
        progressPercent: 0,
        status: 'not_started' as const,
        notes: '',
        attachments: [] as string[],
        isCritical: false,
        plannedCost: taskTemplate.plannedCost,
        paymentStatus: 'pending' as const,
      };

      currentDate = new Date(endDate);
      currentDate.setDate(currentDate.getDate() + 1);
      return task;
    });

    useAppStore.setState({ tasks: [...store.tasks, ...newTasks] });
    setApplyModal(false);
    setCurrentProjectId(applyTargetProject);
    setCurrentPage('gantt');
  };

  // ── Render editoru šablony ─────────────────────────────────────────────────

  if (editorOpen) {
    const totalDuration = sumDuration(form.tasks);

    return (
      <div className="space-y-6">
        {/* Editor header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={closeEditor}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors">
              <X size={18} />
            </button>
            <div>
              <h2 className="font-bold text-lg text-gray-800">
                {editingTemplate ? `Editace: ${editingTemplate.name}` : 'Nová šablona'}
              </h2>
              <p className="text-sm text-gray-500">
                {form.tasks.length} úkolů · {totalDuration} dní celkem
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} /> Uložit šablonu
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Základní info – levý panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Základní informace</h3>
              <div className="space-y-4">
                {/* Název */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Název šablony <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="např. Zděný rodinný dům"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Popis */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Stručný popis šablony..."
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Kategorie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Barva */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barva šablony</label>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setForm(f => ({ ...f, color }))}
                        title={color}
                        className={`w-8 h-8 rounded-full transition-all ${
                          form.color === color
                            ? 'ring-2 ring-offset-2 ring-gray-700 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Náhled */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Náhled karty</h3>
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: form.color }}>
                    <FileStack size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      {form.name || 'Název šablony'}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[form.category] || 'bg-gray-100 text-gray-700'}`}>
                      {form.category}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3">{form.description || 'Popis šablony...'}</p>
                <div className="flex gap-3 text-xs">
                  <span className="bg-white border border-gray-200 rounded px-2 py-1">
                    {form.tasks.length} úkolů
                  </span>
                  <span className="bg-white border border-gray-200 rounded px-2 py-1">
                    <Clock size={10} className="inline mr-1" />{totalDuration} dní
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Správa úkolů – pravý panel */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">
                  Úkoly šablony
                  <span className="ml-2 text-sm font-normal text-gray-400">({form.tasks.length})</span>
                </h3>
                <button
                  onClick={startAddTask}
                  disabled={editingTaskIndex !== null}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  <Plus size={14} /> Přidat úkol
                </button>
              </div>

              {/* Seznam úkolů */}
              {form.tasks.length === 0 && editingTaskIndex === null ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
                  <FileStack size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Zatím žádné úkoly</p>
                  <p className="text-xs mt-1">Klikněte na „Přidat úkol" a vytvořte první krok šablony</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.tasks.map((task, idx) => (
                    <div key={task.id || idx}>
                      {/* Řádek úkolu */}
                      {editingTaskIndex !== idx && (
                        <div className="flex items-center gap-2 border border-gray-100 rounded-xl px-3 py-2 hover:border-gray-200 group">
                          {/* Číslo */}
                          <span className="w-5 h-5 bg-blue-100 rounded text-center text-xs font-bold text-blue-700 leading-5 flex-shrink-0">
                            {idx + 1}
                          </span>

                          {/* Přesun */}
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button onClick={() => moveTask(idx, -1)} disabled={idx === 0}
                              className="text-gray-300 hover:text-gray-600 disabled:opacity-20">
                              <ChevronUp size={13} />
                            </button>
                            <button onClick={() => moveTask(idx, 1)} disabled={idx === form.tasks.length - 1}
                              className="text-gray-300 hover:text-gray-600 disabled:opacity-20">
                              <ChevronDown size={13} />
                            </button>
                          </div>

                          {/* Název */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{task.name}</p>
                            {task.craftId && (
                              <div className="flex items-center gap-1 mt-0.5">
                                {(() => {
                                  const craft = crafts.find(c => c.id === task.craftId);
                                  return craft ? (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full text-white"
                                      style={{ backgroundColor: craft.color }}>
                                      {craft.name}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            )}
                          </div>

                          {/* Délka */}
                          <span className="text-xs text-gray-500 flex items-center gap-0.5 flex-shrink-0">
                            <Clock size={11} /> {task.plannedDuration}d
                          </span>

                          {/* Akce */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditTask(idx)}
                              className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => deleteTask(idx)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline editor úkolu */}
                      {editingTaskIndex === idx && (
                        <div className="border-2 border-blue-300 rounded-xl p-4 bg-blue-50/30">
                          <p className="text-xs font-semibold text-blue-700 mb-3 flex items-center gap-1">
                            <Pencil size={12} />
                            {idx < form.tasks.length ? `Úprava úkolu č. ${idx + 1}` : 'Nový úkol'}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Název úkolu <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={taskDraft.name}
                                onChange={e => setTaskDraft(d => ({ ...d, name: e.target.value }))}
                                placeholder="např. Základová deska"
                                autoFocus
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Trvání (dní)</label>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={taskDraft.plannedDuration}
                                onChange={e => setTaskDraft(d => ({ ...d, plannedDuration: Math.max(1, Number(e.target.value)) }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Řemeslo</label>
                              <select
                                value={taskDraft.craftId}
                                onChange={e => setTaskDraft(d => ({ ...d, craftId: e.target.value }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">— bez řemesla —</option>
                                {crafts.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Popis (volitelné)</label>
                              <input
                                type="text"
                                value={taskDraft.description}
                                onChange={e => setTaskDraft(d => ({ ...d, description: e.target.value }))}
                                placeholder="Stručný popis úkolu..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Odhadovaná cena (Kč)</label>
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                value={taskDraft.plannedCost || 0}
                                onChange={e => setTaskDraft(d => ({ ...d, plannedCost: Number(e.target.value) }))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="flex items-end gap-2">
                              <button onClick={saveTask} disabled={!taskDraft.name.trim()}
                                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1">
                                <Save size={13} /> Uložit
                              </button>
                              <button onClick={cancelTaskEdit}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 text-gray-600">
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Inline editor pro nový úkol (na konci) */}
                  {editingTaskIndex === form.tasks.length && (
                    <div className="border-2 border-blue-300 rounded-xl p-4 bg-blue-50/30">
                      <p className="text-xs font-semibold text-blue-700 mb-3 flex items-center gap-1">
                        <Plus size={12} /> Nový úkol
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Název úkolu <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={taskDraft.name}
                            onChange={e => setTaskDraft(d => ({ ...d, name: e.target.value }))}
                            placeholder="např. Základová deska"
                            autoFocus
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Trvání (dní)</label>
                          <input
                            type="number" min={1} max={365} value={taskDraft.plannedDuration}
                            onChange={e => setTaskDraft(d => ({ ...d, plannedDuration: Math.max(1, Number(e.target.value)) }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Řemeslo</label>
                          <select value={taskDraft.craftId}
                            onChange={e => setTaskDraft(d => ({ ...d, craftId: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— bez řemesla —</option>
                            {crafts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Popis (volitelné)</label>
                          <input type="text" value={taskDraft.description}
                            onChange={e => setTaskDraft(d => ({ ...d, description: e.target.value }))}
                            placeholder="Stručný popis úkolu..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Odhadovaná cena (Kč)</label>
                          <input type="number" min={0} step={1000} value={taskDraft.plannedCost || 0}
                            onChange={e => setTaskDraft(d => ({ ...d, plannedCost: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <button onClick={saveTask} disabled={!taskDraft.name.trim()}
                            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1">
                            <Save size={13} /> Uložit
                          </button>
                          <button onClick={cancelTaskEdit}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 text-gray-600">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Shrnutí */}
              {form.tasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm text-gray-600">
                  <span>{form.tasks.length} úkolů celkem</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Clock size={13} /> {totalDuration} dní
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render karet (výchozí pohled) ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-800">Projektové šablony ({templates.length})</h3>
          <p className="text-sm text-gray-500">Opakovaně použitelné šablony s úkoly a dobami trvání</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Nová šablona
        </button>
      </div>

      {/* Filtr kategorií */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${!selectedCategory ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Vše ({templates.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = templates.filter(t => t.category === cat).length;
          if (count === 0) return null;
          return (
            <button key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Mřížka karet */}
      {filtered.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <FileStack size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Žádné šablony v této kategorii</p>
          <button onClick={openNew}
            className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 mx-auto">
            <Plus size={15} /> Vytvořit šablonu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(template => (
            <div key={template.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: template.color }}>
                    <FileStack size={22} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-800 truncate">{template.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[template.category] || 'bg-gray-100 text-gray-700'}`}>
                      {template.category}
                    </span>
                  </div>
                </div>

                {/* Tlačítka akce */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                  <button
                    onClick={() => openEdit(template)}
                    title="Upravit šablonu"
                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(template.id)}
                    title="Smazat šablonu"
                    className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.description}</p>

              {/* Statistiky */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="font-bold text-gray-800">{template.tasks.length}</div>
                  <div className="text-xs text-gray-500">Úkolů</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="font-bold text-gray-800 flex items-center justify-center gap-1">
                    <Clock size={12} /> {template.estimatedDuration}
                  </div>
                  <div className="text-xs text-gray-500">Dní celkem</div>
                </div>
              </div>

              {/* Řemesla */}
              <div className="flex flex-wrap gap-1 mb-4 min-h-5">
                {[...new Set(template.tasks.map(t => t.craftId).filter(Boolean))].slice(0, 5).map(craftId => {
                  const craft = crafts.find(c => c.id === craftId);
                  if (!craft) return null;
                  return (
                    <span key={craftId} className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: craft.color }}>
                      {craft.name}
                    </span>
                  );
                })}
              </div>

              {/* Náhled úkolů */}
              <div className="border border-gray-100 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 mb-2">Přehled úkolů:</p>
                {template.tasks.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Žádné úkoly</p>
                ) : template.tasks.map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
                    <span className="w-4 h-4 bg-gray-200 rounded text-center leading-4 font-medium flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate">{task.name}</span>
                    <span className="text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                      <Clock size={10} /> {task.plannedDuration}d
                    </span>
                  </div>
                ))}
              </div>

              {/* Akce */}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewingTemplate(template)}
                  className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  Detail
                </button>
                <button
                  onClick={() => openEdit(template)}
                  className="flex items-center justify-center gap-1 px-3 border border-blue-200 text-blue-700 rounded-lg py-2 text-sm hover:bg-blue-50 transition-colors"
                >
                  <Pencil size={13} /> Editovat
                </button>
                <button
                  onClick={() => {
                    setApplyTemplate(template);
                    setApplyTargetProject(projects[0]?.id || '');
                    setApplyModal(true);
                  }}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 flex items-center justify-center gap-1 transition-colors"
                >
                  <Copy size={13} /> Použít
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {viewingTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: viewingTemplate.color }}>
                  <FileStack size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-xl">{viewingTemplate.name}</h3>
                  <p className="text-gray-500 text-sm">{viewingTemplate.description}</p>
                </div>
              </div>
              <button onClick={() => setViewingTemplate(null)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="font-bold text-blue-700 text-lg">{viewingTemplate.tasks.length}</div>
                <div className="text-xs text-blue-500">Úkolů</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <div className="font-bold text-green-700 text-lg">{viewingTemplate.estimatedDuration}</div>
                <div className="text-xs text-green-500">Dní celkem</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <div className={`text-xs px-2 py-1 rounded-full font-semibold ${CATEGORY_COLORS[viewingTemplate.category] || ''}`}>
                  {viewingTemplate.category}
                </div>
              </div>
            </div>

            <h4 className="font-semibold text-gray-800 mb-3">Sled úkolů</h4>
            <div className="space-y-2">
              {viewingTemplate.tasks.map((task, idx) => {
                const craft = crafts.find(c => c.id === task.craftId);
                return (
                  <div key={idx}
                    className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 hover:bg-gray-50">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg text-center leading-7 text-xs font-bold text-blue-700 flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{task.name}</p>
                      {task.description && <p className="text-xs text-gray-400 truncate">{task.description}</p>}
                      {craft && (
                        <span className="text-xs px-2 py-0.5 rounded-full text-white mt-0.5 inline-block"
                          style={{ backgroundColor: craft.color }}>
                          {craft.name}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-600 flex-shrink-0">
                      <Clock size={12} className="inline mr-1" />
                      {task.plannedDuration} dní
                      {task.plannedCost ? (
                        <p className="text-xs text-gray-400">
                          {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', minimumFractionDigits: 0 }).format(task.plannedCost)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setViewingTemplate(null)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">
                Zavřít
              </button>
              <button onClick={() => { openEdit(viewingTemplate); setViewingTemplate(null); }}
                className="flex-1 border border-blue-200 text-blue-700 rounded-lg py-2 text-sm hover:bg-blue-50 flex items-center justify-center gap-1">
                <Pencil size={14} /> Editovat
              </button>
              <button
                onClick={() => {
                  setViewingTemplate(null);
                  setApplyTemplate(viewingTemplate);
                  setApplyTargetProject(projects[0]?.id || '');
                  setApplyModal(true);
                }}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 flex items-center justify-center gap-1">
                <Copy size={14} /> Použít šablonu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Potvrdit smazání ────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Smazat šablonu?</h3>
                <p className="text-sm text-gray-500">
                  {templates.find(t => t.id === deleteConfirm)?.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Tato akce je nevratná. Šablona bude trvale odstraněna.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">
                Zrušit
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700">
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Aplikovat šablonu na projekt ────────────────────────────────────── */}
      {applyModal && applyTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-1">Použít šablonu</h3>
            <p className="text-sm text-gray-500 mb-4">
              Šablona „{applyTemplate.name}" bude aplikována na vybraný projekt.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cílový projekt</label>
                <select value={applyTargetProject} onChange={e => setApplyTargetProject(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Datum zahájení</label>
                <input type="date" value={applyStartDate}
                  onChange={e => setApplyStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                Bude vytvořeno <strong>{applyTemplate.tasks.length}</strong> úkolů
                s celkovou délkou <strong>{applyTemplate.estimatedDuration} dní</strong>.
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setApplyModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">
                Zrušit
              </button>
              <button onClick={handleApplyTemplate}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700">
                Aplikovat šablonu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
