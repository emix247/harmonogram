import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { generateId } from '../utils/helpers';
import {
  Users, Link2, Plus, Edit2, Trash2, Eye, EyeOff,
  Copy, Check, X, Shield, AlertTriangle, Briefcase, Save, ExternalLink,
  Database, Download, Upload, RotateCcw, Clock
} from 'lucide-react';
import type { User, UserRole, ProjectShare, Role } from '../types';

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'bg-red-100 text-red-700', label: 'Červená' },
  { value: 'bg-blue-100 text-blue-700', label: 'Modrá' },
  { value: 'bg-orange-100 text-orange-700', label: 'Oranžová' },
  { value: 'bg-gray-100 text-gray-600', label: 'Šedá' },
  { value: 'bg-green-100 text-green-700', label: 'Zelená' },
  { value: 'bg-purple-100 text-purple-700', label: 'Fialová' },
  { value: 'bg-yellow-100 text-yellow-700', label: 'Žlutá' },
  { value: 'bg-pink-100 text-pink-700', label: 'Růžová' },
];

const emptyUser: Omit<User, 'id'> = {
  name: '',
  email: '',
  loginName: '',
  password: '',
  role: 'viewer',
  companyId: 'c1',
};

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function Settings() {
  const {
    users, projects, projectShares, companies, roles,
    addUser, updateUser, deleteUser,
    addProjectShare, deleteProjectShare,
    addRole, updateRole, deleteRole,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'shares' | 'backup'>('users');

  // ─── User management ───
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<Omit<User, 'id'>>(emptyUser);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<User | null>(null);

  // ─── Role management ───
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleLabel, setEditingRoleLabel] = useState('');
  const [editingRoleColor, setEditingRoleColor] = useState(COLOR_OPTIONS[0].value);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleColor, setNewRoleColor] = useState(COLOR_OPTIONS[3].value);
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<Role | null>(null);

  // ─── Share links ───
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ─── Backup ───
  const SNAPSHOTS_KEY = 'harmonogram-snapshots';
  interface Snapshot { id: string; label: string; date: string; data: string; }
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    try { return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) ?? '[]'); } catch { return []; }
  });
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const handleExport = () => {
    const s = useAppStore.getState();
    const payload = {
      version: '1.0', exportedAt: new Date().toISOString(),
      data: {
        projects: s.projects, tasks: s.tasks, crafts: s.crafts,
        contractors: s.contractors, milestones: s.milestones, risks: s.risks,
        templates: s.templates, taskLogs: s.taskLogs, mobileReports: s.mobileReports,
        conflicts: s.conflicts, phases: s.phases, objects: s.objects,
        projectShares: s.projectShares, roles: s.roles, companies: s.companies,
        users: s.users, currentProjectId: s.currentProjectId,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harmonogram-zaloha-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const data = json.data ?? json;
        useAppStore.setState(data);
        setImportStatus('ok');
        setTimeout(() => setImportStatus('idle'), 3000);
      } catch {
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const saveSnapshot = () => {
    const s = useAppStore.getState();
    const snap: Snapshot = {
      id: generateId(),
      label: `Záloha ${new Date().toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}`,
      date: new Date().toISOString(),
      data: JSON.stringify({
        projects: s.projects, tasks: s.tasks, crafts: s.crafts,
        contractors: s.contractors, milestones: s.milestones, risks: s.risks,
        templates: s.templates, taskLogs: s.taskLogs, mobileReports: s.mobileReports,
        conflicts: s.conflicts, phases: s.phases, objects: s.objects,
        projectShares: s.projectShares, roles: s.roles, companies: s.companies,
        users: s.users, currentProjectId: s.currentProjectId,
      }),
    };
    const updated = [snap, ...snapshots].slice(0, 10);
    setSnapshots(updated);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
  };

  const restoreSnapshot = (snap: Snapshot) => {
    if (!confirm(`Obnovit zálohu "${snap.label}"?\nAktuální data budou přepsána.`)) return;
    useAppStore.setState(JSON.parse(snap.data));
  };

  const deleteSnapshot = (id: string) => {
    const updated = snapshots.filter(s => s.id !== id);
    setSnapshots(updated);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
  };

  const downloadSnapshot = (snap: Snapshot) => {
    const blob = new Blob([snap.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harmonogram-${snap.label.replace(/[^a-z0-9]/gi, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const [deleteShareConfirm, setDeleteShareConfirm] = useState<ProjectShare | null>(null);

  // helpers
  const getRoleBadge = (roleId: string) => {
    const r = roles.find(r => r.id === roleId);
    return r ?? { label: roleId, color: 'bg-gray-100 text-gray-600' };
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm(emptyUser);
    setShowPassword(false);
    setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({ ...user });
    setShowPassword(false);
    setShowUserModal(true);
  };

  const handleSaveUser = () => {
    if (!userForm.name.trim() || !userForm.loginName?.trim()) return;
    if (editingUser) {
      updateUser(editingUser.id, userForm);
    } else {
      addUser({ ...userForm, id: generateId() });
    }
    setShowUserModal(false);
  };

  const handleDeleteUser = () => {
    if (!deleteUserConfirm) return;
    deleteUser(deleteUserConfirm.id);
    setDeleteUserConfirm(null);
  };

  const startEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingRoleLabel(role.label);
    setEditingRoleColor(role.color);
  };

  const saveEditRole = () => {
    if (!editingRoleId || !editingRoleLabel.trim()) return;
    updateRole(editingRoleId, { label: editingRoleLabel.trim(), color: editingRoleColor });
    setEditingRoleId(null);
  };

  const handleAddRole = () => {
    if (!newRoleLabel.trim()) return;
    const id = newRoleLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + generateId().slice(0, 4);
    addRole({ id, label: newRoleLabel.trim(), color: newRoleColor });
    setNewRoleLabel('');
    setNewRoleColor(COLOR_OPTIONS[3].value);
    setShowNewRoleForm(false);
  };

  const handleDeleteRole = () => {
    if (!deleteRoleConfirm) return;
    deleteRole(deleteRoleConfirm.id);
    setDeleteRoleConfirm(null);
  };

  const handleGenerateShare = (projectId: string) => {
    const share: ProjectShare = {
      id: generateId(),
      projectId,
      token: generateToken(),
      createdAt: new Date().toISOString(),
    };
    addProjectShare(share);
  };

  const getShareUrl = (token: string) => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?share=${token}`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const getProjectShares = (projectId: string) =>
    projectShares.filter(s => s.projectId === projectId);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Nastavení</h1>
        <p className="text-sm text-gray-500 mt-1">Správa uživatelů, rolí a sdílené harmonogramy</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'users' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={15} /> Správa uživatelů
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'roles' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Briefcase size={15} /> Správa rolí
        </button>
        <button
          onClick={() => setActiveTab('shares')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'shares' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Link2 size={15} /> Sdílené harmonogramy
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'backup' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Database size={15} /> Zálohy & Export
        </button>
      </div>

      {/* ─── TAB: USERS ─── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">{users.length} uživatelů celkem</p>
            <button
              onClick={openAddUser}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={15} /> Přidat uživatele
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Jméno</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">E-mail</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Přihlašovací jméno</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Heslo</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Společnost</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(user => {
                  const company = companies.find(c => c.id === user.companyId);
                  const badge = getRoleBadge(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                            {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{user.email}</td>
                      <td className="px-5 py-3">
                        {user.loginName ? (
                          <code className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">{user.loginName}</code>
                        ) : (
                          <span className="text-gray-300 text-xs">–</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {user.password ? (
                          <span className="text-gray-400 text-xs tracking-widest">{'•'.repeat(Math.min(user.password.length, 8))}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">–</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{company?.name || '–'}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditUser(user)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteUserConfirm(user)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: ROLES ─── */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">{roles.length} rolí celkem</p>
            <button
              onClick={() => { setShowNewRoleForm(true); setEditingRoleId(null); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={15} /> Přidat roli
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Název role</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Ukázka</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Barva</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Typ</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.map(role => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      {editingRoleId === role.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingRoleLabel}
                          onChange={e => setEditingRoleLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditRole(); if (e.key === 'Escape') setEditingRoleId(null); }}
                          className="border border-blue-300 rounded-lg px-2 py-1 text-sm w-48 outline-none ring-2 ring-blue-200"
                        />
                      ) : (
                        <span className="font-medium text-gray-800">{role.label}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${editingRoleId === role.id ? editingRoleColor : role.color}`}>
                        {editingRoleId === role.id ? editingRoleLabel || role.label : role.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {editingRoleId === role.id ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {COLOR_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setEditingRoleColor(opt.value)}
                              title={opt.label}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${opt.value.replace('text-', 'bg-').split(' ')[0]} ${
                                editingRoleColor === opt.value ? 'border-gray-700 scale-110' : 'border-transparent'
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className={`inline-block w-4 h-4 rounded-full ${role.color.split(' ')[0].replace('bg-', 'bg-')}`} />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {role.builtIn ? (
                        <span className="text-xs text-gray-400">Výchozí</span>
                      ) : (
                        <span className="text-xs text-blue-500">Vlastní</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {editingRoleId === role.id ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={saveEditRole}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Uložit"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => setEditingRoleId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                            title="Zrušit"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => startEditRole(role)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Upravit"
                          >
                            <Edit2 size={14} />
                          </button>
                          {!role.builtIn && (
                            <button
                              onClick={() => setDeleteRoleConfirm(role)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Smazat"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {/* New role inline form */}
                {showNewRoleForm && (
                  <tr className="bg-blue-50">
                    <td className="px-5 py-3">
                      <input
                        autoFocus
                        type="text"
                        value={newRoleLabel}
                        onChange={e => setNewRoleLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddRole(); if (e.key === 'Escape') setShowNewRoleForm(false); }}
                        placeholder="Název nové role..."
                        className="border border-blue-300 rounded-lg px-2 py-1 text-sm w-48 outline-none ring-2 ring-blue-200"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${newRoleColor}`}>
                        {newRoleLabel || 'Ukázka'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {COLOR_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setNewRoleColor(opt.value)}
                            title={opt.label}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${opt.value.split(' ')[0]} ${
                              newRoleColor === opt.value ? 'border-gray-700 scale-110' : 'border-transparent'
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-blue-500">Vlastní</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={handleAddRole}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Přidat"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => setShowNewRoleForm(false)}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                          title="Zrušit"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400">
            Výchozí role lze přejmenovat a obarvit. Vlastní role lze také smazat. Role se přiřazují uživatelům v záložce Správa uživatelů.
          </p>
        </div>
      )}

      {/* ─── TAB: SHARES ─── */}
      {activeTab === 'shares' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Sdílené harmonogramy jsou určeny pro subdodavatele a investory</p>
              <p className="text-blue-600 mt-1">Příjemce odkazu uvidí pouze <strong>Harmonogram práce</strong> a <strong>Úkoly</strong> pro daný projekt — bez možnosti editace.</p>
            </div>
          </div>

          <div className="space-y-4">
            {projects.map(project => {
              const shares = getProjectShares(project.id);
              return (
                <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                      <div>
                        <h3 className="font-semibold text-gray-800 text-sm">{project.name}</h3>
                        <p className="text-xs text-gray-400">{project.address}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerateShare(project.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus size={13} /> Vygenerovat odkaz
                    </button>
                  </div>

                  {shares.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {shares.map(share => {
                        const url = getShareUrl(share.token);
                        const isCopied = copiedId === share.id;
                        return (
                          <div key={share.id} className="flex items-center gap-3 px-5 py-3">
                            <Link2 size={14} className="text-blue-400 shrink-0" />
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Otevřít sdílený pohled"
                              className="flex-1 text-xs text-blue-600 bg-gray-50 px-3 py-1.5 rounded-lg font-mono truncate border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              {url}
                            </a>
                            <span className="text-xs text-gray-400 shrink-0">
                              {new Date(share.createdAt).toLocaleDateString('cs-CZ')}
                            </span>
                            <button
                              onClick={() => copyToClipboard(url, share.id)}
                              title="Kopírovat odkaz"
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                                isCopied
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                              }`}
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                              {isCopied ? 'Zkopírováno!' : 'Kopírovat'}
                            </button>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Otevřít v novém tabu"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <ExternalLink size={13} />
                            </a>
                            <button
                              onClick={() => setDeleteShareConfirm(share)}
                              className="p-1.5 text-gray-300 hover:text-red-500 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-4 text-xs text-gray-400 italic">
                      Žádné sdílené odkazy — klikněte na „Vygenerovat odkaz"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── USER MODAL ─── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingUser ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
              <button onClick={() => setShowUserModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celé jméno *</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ing. Jan Novák"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Přihlašovací jméno *</label>
                  <input
                    type="text"
                    value={userForm.loginName || ''}
                    onChange={e => setUserForm(f => ({ ...f, loginName: e.target.value }))}
                    placeholder="novak"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heslo *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={userForm.password || ''}
                      onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-9"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jan@tesgrup.cz"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowUserModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">
                Zrušit
              </button>
              <button onClick={handleSaveUser}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 font-medium">
                {editingUser ? 'Uložit změny' : 'Vytvořit uživatele'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE USER CONFIRM ─── */}
      {deleteUserConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Smazat uživatele?</h3>
            <p className="text-sm text-gray-600">
              Opravdu chcete smazat uživatele <strong>{deleteUserConfirm.name}</strong>?
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteUserConfirm(null)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleDeleteUser}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 font-medium">Smazat</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE ROLE CONFIRM ─── */}
      {deleteRoleConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Smazat roli?</h3>
            <p className="text-sm text-gray-600">
              Opravdu chcete smazat roli <strong>{deleteRoleConfirm.label}</strong>?
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteRoleConfirm(null)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={handleDeleteRole}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 font-medium">Smazat</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: BACKUP ─── */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Export / Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Download size={18} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Export dat</h3>
                  <p className="text-xs text-gray-500">Stáhnout veškerá data jako JSON soubor</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Exportuje všechny projekty, úkoly, řemesla, zhotovitele, milníky, rizika a nastavení do přenosného souboru.
              </p>
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download size={15} /> Exportovat zálohu
              </button>
            </div>

            {/* Import */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Upload size={18} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Import dat</h3>
                  <p className="text-xs text-gray-500">Obnovit data ze záložního souboru</p>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-orange-700">
                  <strong>Upozornění:</strong> Import přepíše veškerá aktuální data. Doporučujeme nejdříve vytvořit zálohu.
                </p>
              </div>
              {importStatus === 'ok' && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 text-xs text-green-700 flex items-center gap-2">
                  <Check size={13} /> Data úspěšně obnovena!
                </div>
              )}
              {importStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-xs text-red-700 flex items-center gap-2">
                  <X size={13} /> Chyba při čtení souboru. Zkontrolujte formát.
                </div>
              )}
              <label className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors cursor-pointer">
                <Upload size={15} /> Importovat ze souboru
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
            </div>
          </div>

          {/* Manual snapshots */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" /> Rychlé zálohy
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Uloženo v prohlížeči (max 10) · Rychlé obnovení jedním klikem</p>
              </div>
              <button
                onClick={saveSnapshot}
                className="flex items-center gap-1.5 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
              >
                <Database size={14} /> Uložit zálohu nyní
              </button>
            </div>

            {snapshots.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Database size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Žádné zálohy. Klikněte „Uložit zálohu nyní" pro první záznam.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {snapshots.map((snap) => {
                  const d = new Date(snap.date);
                  const sizeKB = Math.round(snap.data.length / 1024);
                  return (
                    <div key={snap.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <Database size={14} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{snap.label}</p>
                        <p className="text-xs text-gray-400">
                          {d.toLocaleDateString('cs-CZ')} {d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })} · {sizeKB} kB
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => restoreSnapshot(snap)}
                          title="Obnovit tuto zálohu"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                        >
                          <RotateCcw size={12} /> Obnovit
                        </button>
                        <button
                          onClick={() => downloadSnapshot(snap)}
                          title="Stáhnout jako soubor"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={() => deleteSnapshot(snap.id)}
                          title="Smazat zálohu"
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg border border-gray-200"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── DELETE SHARE CONFIRM ─── */}
      {deleteShareConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={40} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Zrušit sdílený odkaz?</h3>
            <p className="text-sm text-gray-600 mb-1">
              Odkaz přestane fungovat. Příjemci ztratí přístup.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteShareConfirm(null)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50">Zrušit</button>
              <button onClick={() => { deleteProjectShare(deleteShareConfirm!.id); setDeleteShareConfirm(null); }}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm hover:bg-red-700 font-medium">Zrušit odkaz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
