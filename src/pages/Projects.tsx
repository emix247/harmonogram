import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { formatDate, formatCurrency, statusColor, statusLabel, generateId } from '../utils/helpers';
import {
  Plus, Edit2, Trash2, Building2, Calendar, DollarSign, MapPin,
  ChevronDown, ChevronRight, Layers, Box, ArrowLeft, AlertTriangle, X
} from 'lucide-react';
import type { Project, Phase, ProjectObject } from '../types';

const emptyProject: Omit<Project, 'id'> = {
  name: '',
  companyId: 'c1',
  description: '',
  plannedStart: new Date().toISOString().split('T')[0],
  plannedEnd: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
  status: 'planning',
  budget: 0,
  phases: [],
  objects: [],
  managerId: 'u2',
  address: '',
  color: '#3b82f6',
};

const PHASE_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f97316','#ef4444','#06b6d4','#ec4899','#84cc16'];

export default function Projects() {
  const {
    projects, tasks, phases, objects,
    addProject, updateProject, deleteProject,
    addPhase, updatePhase, deletePhase,
    addObject, updateObject, deleteObject,
    users, companies,
  } = useAppStore();

  // ─── View state ───
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // ─── Project modal ───
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState<Omit<Project, 'id'>>(emptyProject);
  const [filterStatus, setFilterStatus] = useState('all');

  // ─── Phase modal ───
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [phaseForm, setPhaseForm] = useState({ name: '', description: '', color: '#3b82f6', order: 0, plannedStart: '', plannedEnd: '' });

  // ─── Object modal ───
  const [showObjectModal, setShowObjectModal] = useState(false);
  const [editingObject, setEditingObject] = useState<ProjectObject | null>(null);
  const [objectForm, setObjectForm] = useState({ name: '', description: '', phaseId: '', plannedStart: '', plannedEnd: '' });

  // ─── Delete confirm ───
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'project' | 'phase' | 'object'; id: string; name: string } | null>(null);

  // ─── Collapsed phases ───
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  // ─── Helpers ───
  const filteredProjects = filterStatus === 'all' ? projects : projects.filter(p => p.status === filterStatus);
  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;

  const getProjectStats = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    const completed = projectTasks.filter(t => t.status === 'completed').length;
    const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
    return { total: projectTasks.length, completed, progress };
  };

  const getObjectStats = (objectId: string, projectId: string) => {
    const objectTasks = tasks.filter(t => t.projectId === projectId && t.objectId === objectId);
    const completed = objectTasks.filter(t => t.status === 'completed').length;
    const progress = objectTasks.length > 0 ? Math.round((completed / objectTasks.length) * 100) : 0;
    return { total: objectTasks.length, completed, progress };
  };

  const togglePhaseCollapse = (phaseId: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  // ─── Project CRUD ───
  const openAddProject = () => {
    setEditingProject(null);
    setProjectForm(emptyProject);
    setShowProjectModal(true);
  };
  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm({ ...project });
    setShowProjectModal(true);
  };
  const handleSaveProject = () => {
    if (!projectForm.name.trim()) return;
    if (editingProject) {
      updateProject(editingProject.id, projectForm);
    } else {
      addProject({ ...projectForm, id: generateId() });
    }
    setShowProjectModal(false);
  };

  // ─── Phase CRUD ───
  const openAddPhase = () => {
    if (!selectedProjectId) return;
    const existing = phases.filter(p => p.projectId === selectedProjectId);
    setEditingPhase(null);
    setPhaseForm({ name: '', description: '', color: PHASE_COLORS[existing.length % PHASE_COLORS.length], order: existing.length, plannedStart: '', plannedEnd: '' });
    setShowPhaseModal(true);
  };
  const openEditPhase = (phase: Phase) => {
    setEditingPhase(phase);
    setPhaseForm({ name: phase.name, description: phase.description || '', color: phase.color || '#3b82f6', order: phase.order || 0, plannedStart: phase.plannedStart || '', plannedEnd: phase.plannedEnd || '' });
    setShowPhaseModal(true);
  };
  const handleSavePhase = () => {
    if (!phaseForm.name.trim() || !selectedProjectId) return;
    if (editingPhase) {
      updatePhase(editingPhase.id, phaseForm);
    } else {
      addPhase({ id: generateId(), projectId: selectedProjectId, ...phaseForm });
    }
    setShowPhaseModal(false);
  };

  // ─── Object CRUD ───
  const openAddObject = (phaseId?: string) => {
    if (!selectedProjectId) return;
    setEditingObject(null);
    setObjectForm({ name: '', description: '', phaseId: phaseId || '', plannedStart: '', plannedEnd: '' });
    setShowObjectModal(true);
  };
  const openEditObject = (obj: ProjectObject) => {
    setEditingObject(obj);
    setObjectForm({ name: obj.name, description: obj.description || '', phaseId: obj.phaseId || '', plannedStart: obj.plannedStart || '', plannedEnd: obj.plannedEnd || '' });
    setShowObjectModal(true);
  };
  const handleSaveObject = () => {
    if (!objectForm.name.trim() || !selectedProjectId) return;
    if (editingObject) {
      updateObject(editingObject.id, objectForm);
    } else {
      addObject({ id: generateId(), projectId: selectedProjectId, ...objectForm });
    }
    setShowObjectModal(false);
  };

  // ─── Delete confirm ───
  const handleDeleteConfirmed = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'project') deleteProject(deleteConfirm.id);
    if (deleteConfirm.type === 'phase') deletePhase(deleteConfirm.id);
    if (deleteConfirm.type === 'object') deleteObject(deleteConfirm.id);
    setDeleteConfirm(null);
    if (deleteConfirm.type === 'project') setView('list');
  };

  const openDetail = (projectId: string) => {
    setSelectedProjectId(projectId);
    setView('detail');
  };

  const statusOptions = [
    { value: 'all', label: 'Všechny stavy' },
    { value: 'planning', label: 'Plánování' },
    { value: 'active', label: 'Aktivní' },
    { value: 'paused', label: 'Pozastaveno' },
    { value: 'completed', label: 'Dokončeno' },
  ];

  // ─────────────────────────────────────────────────────────
  //  DETAIL VIEW
  // ─────────────────────────────────────────────────────────
  if (view === 'detail' && selectedProject) {
    const projectPhases = phases
      .filter(ph => ph.projectId === selectedProject.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const projectObjects = objects.filter(o => o.projectId === selectedProject.id);
    const orphanObjects = projectObjects.filter(o => !o.phaseId);
    const stats = getProjectStats(selectedProject.id);
    const manager = users.find(u => u.id === selectedProject.managerId);
    const company = companies.find(c => c.id === selectedProject.companyId);

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Projekty
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700 text-sm font-medium">{selectedProject.name}</span>
        </div>

        {/* Project Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="h-2" style={{ backgroundColor: selectedProject.color }} />
          <div className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold text-gray-800">{selectedProject.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(selectedProject.status)}`}>
                    {statusLabel(selectedProject.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{company?.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditProject(selectedProject)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Edit2 size={13} /> Upravit
                </button>
                <button
                  onClick={() => setDeleteConfirm({ type: 'project', id: selectedProject.id, name: selectedProject.name })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={13} /> Smazat
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400" />
                <span>{selectedProject.address || '–'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={14} className="text-gray-400" />
                <span>{formatDate(selectedProject.plannedStart)} – {formatDate(selectedProject.plannedEnd)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <DollarSign size={14} className="text-gray-400" />
                <span>{formatCurrency(selectedProject.budget)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 size={14} className="text-gray-400" />
                <span>{manager?.name || '–'}</span>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Celkový postup ({stats.completed}/{stats.total} úkolů)</span>
                <span className="font-medium">{stats.progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="h-2.5 rounded-full" style={{ width: `${stats.progress}%`, backgroundColor: selectedProject.color }} />
              </div>
            </div>

            {selectedProject.description && (
              <p className="text-sm text-gray-500 mt-3">{selectedProject.description}</p>
            )}
          </div>
        </div>

        {/* Fáze & Objekty Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Layers size={18} className="text-purple-500" /> Fáze &amp; Objekty
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => openAddObject()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Box size={14} /> Přidat objekt
            </button>
            <button
              onClick={openAddPhase}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} /> Přidat fázi
            </button>
          </div>
        </div>

        {/* Phases list */}
        <div className="space-y-4">
          {projectPhases.length === 0 && orphanObjects.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-12 text-center">
              <Layers size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400 text-sm">Žádné fáze ani objekty</p>
              <p className="text-gray-400 text-xs mt-1">Přidejte fázi nebo objekt tlačítky výše</p>
            </div>
          )}

          {projectPhases.map(phase => {
            const phaseObjects = projectObjects.filter(o => o.phaseId === phase.id);
            const isCollapsed = collapsedPhases.has(phase.id);
            return (
              <div key={phase.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Phase header */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-100" style={{ borderLeftColor: phase.color, borderLeftWidth: 4 }}>
                  <button onClick={() => togglePhaseCollapse(phase.id)} className="text-gray-400 hover:text-gray-600">
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800">{phase.name}</h4>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{phaseObjects.length} objektů</span>
                    </div>
                    {phase.description && <p className="text-xs text-gray-500 mt-0.5">{phase.description}</p>}
                    {(phase.plannedStart || phase.plannedEnd) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {phase.plannedStart ? formatDate(phase.plannedStart) : '?'} – {phase.plannedEnd ? formatDate(phase.plannedEnd) : '?'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openAddObject(phase.id)}
                      title="Přidat objekt do fáze"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => openEditPhase(phase)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'phase', id: phase.id, name: phase.name })}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Objects in phase */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-50">
                    {phaseObjects.length === 0 ? (
                      <div className="px-6 py-4 text-sm text-gray-400 italic">
                        Žádné objekty v této fázi —{' '}
                        <button onClick={() => openAddObject(phase.id)} className="text-blue-500 hover:underline">přidat objekt</button>
                      </div>
                    ) : (
                      phaseObjects.map(obj => {
                        const objStats = getObjectStats(obj.id, selectedProject.id);
                        return (
                          <div key={obj.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 group">
                            <Box size={15} className="text-gray-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700 text-sm">{obj.name}</span>
                                <span className="text-xs text-gray-400">{objStats.total} úkolů</span>
                              </div>
                              {obj.description && <p className="text-xs text-gray-400 truncate">{obj.description}</p>}
                              {(obj.plannedStart || obj.plannedEnd) && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {obj.plannedStart ? formatDate(obj.plannedStart) : '?'} – {obj.plannedEnd ? formatDate(obj.plannedEnd) : '?'}
                                </p>
                              )}
                            </div>
                            {objStats.total > 0 && (
                              <div className="flex items-center gap-2 w-32 shrink-0">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${objStats.progress}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 w-8 text-right">{objStats.progress}%</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => openEditObject(obj)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ type: 'object', id: obj.id, name: obj.name })}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Orphan objects (no phase) */}
          {orphanObjects.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50">
                <Box size={16} className="text-gray-400" />
                <h4 className="font-medium text-gray-600 text-sm">Objekty bez fáze</h4>
                <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{orphanObjects.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {orphanObjects.map(obj => {
                  const objStats = getObjectStats(obj.id, selectedProject.id);
                  return (
                    <div key={obj.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 group">
                      <Box size={15} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700 text-sm">{obj.name}</span>
                          <span className="text-xs text-gray-400">{objStats.total} úkolů</span>
                        </div>
                        {obj.description && <p className="text-xs text-gray-400 truncate">{obj.description}</p>}
                      </div>
                      {objStats.total > 0 && (
                        <div className="flex items-center gap-2 w-32 shrink-0">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${objStats.progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{objStats.progress}%</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEditObject(obj)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'object', id: obj.id, name: obj.name })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Phase Modal */}
        {showPhaseModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{editingPhase ? 'Upravit fázi' : 'Nová fáze'}</h3>
                <button onClick={() => setShowPhaseModal(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Název fáze *</label>
                  <input type="text" value={phaseForm.name}
                    onChange={e => setPhaseForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="např. Hrubá stavba"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                  <textarea value={phaseForm.description}
                    onChange={e => setPhaseForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zahájení</label>
                    <input type="date" value={phaseForm.plannedStart}
                      onChange={e => setPhaseForm(f => ({ ...f, plannedStart: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dokončení</label>
                    <input type="date" value={phaseForm.plannedEnd}
                      onChange={e => setPhaseForm(f => ({ ...f, plannedEnd: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barva fáze</label>
                  <div className="flex gap-2 flex-wrap">
                    {PHASE_COLORS.map(color => (
                      <button key={color} onClick={() => setPhaseForm(f => ({ ...f, color }))}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${phaseForm.color === color ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pořadí</label>
                  <input type="number" value={phaseForm.order} min={0}
                    onChange={e => setPhaseForm(f => ({ ...f, order: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowPhaseModal(false)}
                  className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
                <button onClick={handleSavePhase}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 font-medium">Uložit</button>
              </div>
            </div>
          </div>
        )}

        {/* Object Modal */}
        {showObjectModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">{editingObject ? 'Upravit objekt' : 'Nový objekt'}</h3>
                <button onClick={() => setShowObjectModal(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Název objektu *</label>
                  <input type="text" value={objectForm.name}
                    onChange={e => setObjectForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="např. Blok A, Garáže, Inženýrské sítě"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fáze (volitelné)</label>
                  <select value={objectForm.phaseId}
                    onChange={e => setObjectForm(f => ({ ...f, phaseId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Bez fáze —</option>
                    {projectPhases.map(ph => (
                      <option key={ph.id} value={ph.id}>{ph.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                  <textarea value={objectForm.description}
                    onChange={e => setObjectForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zahájení</label>
                    <input type="date" value={objectForm.plannedStart}
                      onChange={e => setObjectForm(f => ({ ...f, plannedStart: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dokončení</label>
                    <input type="date" value={objectForm.plannedEnd}
                      onChange={e => setObjectForm(f => ({ ...f, plannedEnd: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowObjectModal(false)}
                  className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
                <button onClick={handleSaveObject}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 font-medium">Uložit</button>
              </div>
            </div>
          </div>
        )}

        {/* Project Edit Modal (reused) */}
        {showProjectModal && (
          <ProjectModal
            form={projectForm}
            setForm={setProjectForm}
            isEditing={!!editingProject}
            users={users}
            onSave={handleSaveProject}
            onClose={() => setShowProjectModal(false)}
          />
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirm && (
          <DeleteConfirmModal
            name={deleteConfirm.name}
            type={deleteConfirm.type}
            onConfirm={handleDeleteConfirmed}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  //  LIST VIEW
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={openAddProject}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Nový projekt
        </button>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.map(project => {
          const stats = getProjectStats(project.id);
          const manager = users.find(u => u.id === project.managerId);
          const company = companies.find(c => c.id === project.companyId);
          const projectPhaseCount = phases.filter(ph => ph.projectId === project.id).length;
          const projectObjectCount = objects.filter(o => o.projectId === project.id).length;
          return (
            <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-2" style={{ backgroundColor: project.color }} />
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-sm leading-tight">{project.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{company?.name}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => openEditProject(project)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'project', id: project.id, name: project.name })}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-3 ${statusColor(project.status)}`}>
                  {statusLabel(project.status)}
                </span>

                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>

                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} /> <span>{project.address || '–'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} /> <span>{formatDate(project.plannedStart)} – {formatDate(project.plannedEnd)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={11} /> <span>{formatCurrency(project.budget)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 size={11} /> <span>Manažer: {manager?.name || '–'}</span>
                  </div>
                </div>

                {/* Phase & Object badges */}
                <div className="flex gap-2 mt-3">
                  <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                    <Layers size={10} /> {projectPhaseCount} fází
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    <Box size={10} /> {projectObjectCount} objektů
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Postup ({stats.completed}/{stats.total} úkolů)</span>
                    <span className="font-medium">{stats.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${stats.progress}%`, backgroundColor: project.color }} />
                  </div>
                </div>

                {/* Manage button */}
                <button
                  onClick={() => openDetail(project.id)}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  <Layers size={13} /> Spravovat fáze &amp; objekty
                </button>
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Žádné projekty nenalezeny</p>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <ProjectModal
          form={projectForm}
          setForm={setProjectForm}
          isEditing={!!editingProject}
          users={users}
          onSave={handleSaveProject}
          onClose={() => setShowProjectModal(false)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <DeleteConfirmModal
          name={deleteConfirm.name}
          type={deleteConfirm.type}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────

type User = { id: string; name: string };

function ProjectModal({
  form, setForm, isEditing, users, onSave, onClose,
}: {
  form: Omit<Project, 'id'>;
  setForm: (f: Omit<Project, 'id'>) => void;
  isEditing: boolean;
  users: User[];
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">{isEditing ? 'Upravit projekt' : 'Nový projekt'}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Název projektu *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Název projektu" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Popis projektu" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresa / Lokalita</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Adresa stavby" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zahájení</label>
              <input type="date" value={form.plannedStart} onChange={e => setForm({ ...form, plannedStart: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dokončení</label>
              <input type="date" value={form.plannedEnd} onChange={e => setForm({ ...form, plannedEnd: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stav</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Project['status'] })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="planning">Plánování</option>
                <option value="active">Aktivní</option>
                <option value="paused">Pozastaveno</option>
                <option value="completed">Dokončeno</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rozpočet (Kč)</label>
              <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manažer projektu</label>
              <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barva projektu</label>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                className="w-full border border-gray-200 rounded-lg h-9 px-1 py-1" />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Zrušit</button>
          <button onClick={onSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            {isEditing ? 'Uložit změny' : 'Vytvořit projekt'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  name, type, onConfirm, onCancel,
}: {
  name: string;
  type: 'project' | 'phase' | 'object';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const typeLabel = type === 'project' ? 'projekt' : type === 'phase' ? 'fázi' : 'objekt';
  const warning = type === 'project'
    ? 'Všechny fáze a objekty tohoto projektu budou také odebrány ze struktury.'
    : type === 'phase'
    ? 'Objekty přiřazené k této fázi zůstanou, ale budou přeřazeny do sekce "Bez fáze".'
    : '';
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-2">Smazat {typeLabel}?</h3>
        <p className="text-sm text-gray-600 mb-2">
          Opravdu chcete smazat <strong>"{name}"</strong>? Tato akce je nevratná.
        </p>
        {warning && <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2 mb-4">{warning}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 font-medium">Smazat</button>
        </div>
      </div>
    </div>
  );
}
