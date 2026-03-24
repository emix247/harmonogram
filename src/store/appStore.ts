import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project, Task, Craft, Contractor, Milestone, Risk, Template,
  TaskLog, MobileReport, ConflictAlert, Company, User, Phase, ProjectObject, ProjectShare, Role, ProjectCraftAssignment,
  NotificationSettings, NotificationRecord, PendingNotification, NotificationRule, ProjectNotificationConfig,
} from '../types';

// =================== DEFAULT NOTIFICATION RULES ===================

const DEFAULT_CASCADE_INTRO = 'z důvodu posunu předcházejících prací došlo ke změně termínu zahájení Vašeho úkolu. Prosíme o potvrzení, že nový termín berete na vědomí a je pro Vás akceptovatelný.';
const DEFAULT_CASCADE_FOOTER = 'Tato zpráva byla automaticky odeslána systémem Plánování staveb. Tlačítko slouží k potvrzení přijetí informace, nevyžaduje přihlášení.';
const DEFAULT_REMINDER_INTRO = 'dovolujeme si Vám připomenout blížící se termín Vašeho úkolu. Ujistěte se prosím, že práce probíhají dle plánu a termín bude dodržen.';
const DEFAULT_REMINDER_FOOTER = 'Tato zpráva byla automaticky odeslána systémem Plánování staveb.';
const DEFAULT_EMAIL_NOTE = 'Pokud máte dotazy, odpovězte prosím na tento email nebo kontaktujte projektového manažera.';

export const defaultNotificationRules: NotificationRule[] = [
  {
    id: 'default-cascade',
    name: 'Posun termínu (kaskáda)',
    enabled: true,
    trigger: 'cascade',
    minShiftDays: 1,
    daysBeforeDeadline: 0,
    projectIds: [],
    emailSubject: 'Změna termínu: {{ukolNazev}} (nástup {{novyNastup}})',
    emailIntro: DEFAULT_CASCADE_INTRO,
    emailFooter: DEFAULT_CASCADE_FOOTER,
    emailNote: DEFAULT_EMAIL_NOTE,
    showConfirmButton: true,
    ccEmails: [],
    internalEmails: [],
    internalTaskIds: [],
  },
  {
    id: 'default-reminder',
    name: 'Připomínka 3 dny před termínem',
    enabled: false,
    trigger: 'deadline_reminder',
    minShiftDays: 0,
    daysBeforeDeadline: 3,
    projectIds: [],
    emailSubject: 'Připomínka: {{ukolNazev}} za {{dniDoKonce}} dní',
    emailIntro: DEFAULT_REMINDER_INTRO,
    emailFooter: DEFAULT_REMINDER_FOOTER,
    emailNote: DEFAULT_EMAIL_NOTE,
    showConfirmButton: false,
    ccEmails: [],
    internalEmails: [],
    internalTaskIds: [],
  },
];

// =================== DEPENDENCY CASCADE HELPERS ===================

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function diffDays(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  );
}

// Snap a date forward to the nearest Mon–Fri workday (no-op if already a workday).
function toWorkday(dateStr: string): string {
  const d = new Date(dateStr);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Cascades date changes through the dependency chain (BFS).
 * When a task's dates change, all tasks that depend on it are recalculated,
 * and the propagation continues recursively.
 */
function cascadeTaskDates(changedId: string, taskList: Task[]): Task[] {
  const result = taskList.map((t) => ({ ...t }));
  const queue: string[] = [changedId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const changedTask = result.find((t) => t.id === id);
    if (!changedTask) continue;

    for (const dep of result) {
      if (!dep.predecessors?.length) continue;
      const link = dep.predecessors.find((p) => p.taskId === id);
      if (!link) continue;

      const lag = link.lag ?? 0;
      const duration = Math.max(0, diffDays(dep.plannedStart, dep.plannedEnd));
      let newStart = dep.plannedStart;
      let newEnd = dep.plannedEnd;

      if (link.type === 'FS') {
        // Successor starts the day AFTER predecessor finishes (+ lag); never on the same day
        newStart = toWorkday(addDaysStr(changedTask.plannedEnd, lag + 1));
        newEnd = toWorkday(addDaysStr(newStart, duration));
      } else if (link.type === 'SS') {
        // Successor starts at the same time as predecessor + lag
        newStart = toWorkday(addDaysStr(changedTask.plannedStart, lag));
        newEnd = toWorkday(addDaysStr(newStart, duration));
      } else if (link.type === 'FF') {
        // Successor finishes at the same time as predecessor + lag
        newEnd = toWorkday(addDaysStr(changedTask.plannedEnd, lag));
        newStart = toWorkday(addDaysStr(newEnd, -duration));
      }

      if (newStart !== dep.plannedStart || newEnd !== dep.plannedEnd) {
        dep.plannedStart = newStart;
        dep.plannedEnd = newEnd;
        dep.plannedDuration = diffDays(newStart, newEnd);
        queue.push(dep.id);
      }
    }
  }

  return result;
}

// =================== DEFAULT ROLES ===================

const defaultRoles: Role[] = [
  { id: 'admin', label: 'Administrátor', color: 'bg-red-100 text-red-700', builtIn: true },
  { id: 'project_manager', label: 'Projektový manažer', color: 'bg-blue-100 text-blue-700', builtIn: true },
  { id: 'site_manager', label: 'Stavbyvedoucí', color: 'bg-orange-100 text-orange-700', builtIn: true },
  { id: 'viewer', label: 'Prohlížeč', color: 'bg-gray-100 text-gray-600', builtIn: true },
];


// =================== STORE ===================

interface AppState {
  // Data
  companies: Company[];
  users: User[];
  projects: Project[];
  tasks: Task[];
  crafts: Craft[];
  contractors: Contractor[];
  milestones: Milestone[];
  risks: Risk[];
  templates: Template[];
  taskLogs: TaskLog[];
  mobileReports: MobileReport[];
  conflicts: ConflictAlert[];
  phases: Phase[];
  objects: ProjectObject[];
  projectShares: ProjectShare[];
  projectCraftAssignments: ProjectCraftAssignment[];
  taskOrder: string[];
  roles: Role[];

  // UI State
  currentProjectId: string | null;
  currentPage: string;

  // Actions
  setCurrentProjectId: (id: string | null) => void;
  setCurrentPage: (page: string) => void;
  setConflicts: (conflicts: ConflictAlert[]) => void;

  // Task Actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  // Project Actions
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Milestone Actions
  addMilestone: (milestone: Milestone) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;

  // Risk Actions
  addRisk: (risk: Risk) => void;
  updateRisk: (id: string, updates: Partial<Risk>) => void;
  deleteRisk: (id: string) => void;

  // Mobile Report Actions
  addMobileReport: (report: MobileReport) => void;

  // Template Actions
  addTemplate: (template: Template) => void;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  deleteTemplate: (id: string) => void;

  // Phase Actions
  addPhase: (phase: Phase) => void;
  updatePhase: (id: string, updates: Partial<Phase>) => void;
  deletePhase: (id: string) => void;

  // Object Actions
  addObject: (obj: ProjectObject) => void;
  updateObject: (id: string, updates: Partial<ProjectObject>) => void;
  deleteObject: (id: string) => void;

  // User Actions
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Role Actions
  addRole: (role: Role) => void;
  updateRole: (id: string, updates: Partial<Role>) => void;
  deleteRole: (id: string) => void;

  // Project Share Actions
  addProjectShare: (share: ProjectShare) => void;
  deleteProjectShare: (id: string) => void;

  // Project-Craft Assignment Actions
  setProjectCraftAssignment: (pa: ProjectCraftAssignment) => void;
  clearProjectCraftAssignment: (projectId: string, craftId: string) => void;

  // Task Order Actions
  setTaskOrder: (ids: string[]) => void;

  // Log Actions
  addLog: (log: TaskLog) => void;

  // Notification Actions
  notificationSettings: NotificationSettings[];   // kept for backward compat
  notificationRules: NotificationRule[];
  notificationRecords: NotificationRecord[];
  pendingNotifications: PendingNotification[];
  projectNotificationConfigs: ProjectNotificationConfig[];
  updateNotificationSettings: (projectId: string, enabled: boolean) => void;
  addNotificationRule: (rule: NotificationRule) => void;
  updateNotificationRule: (id: string, updates: Partial<NotificationRule>) => void;
  deleteNotificationRule: (id: string) => void;
  addNotificationRecord: (record: NotificationRecord) => void;
  updateNotificationRecord: (id: string, updates: Partial<NotificationRecord>) => void;
  clearPendingNotifications: () => void;
  appendPendingNotifications: (items: PendingNotification[]) => void;
  syncConfirmations: (confirmed: Record<string, string>) => void;
  setProjectNotificationConfig: (config: ProjectNotificationConfig) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      companies: [],
      users: [],
      projects: [],
      tasks: [],
      crafts: [],
      contractors: [],
      milestones: [],
      risks: [],
      templates: [],
      taskLogs: [],
      mobileReports: [],
      conflicts: [],
      phases: [],
      objects: [],
      projectShares: [],
      projectCraftAssignments: [],
      taskOrder: [],
      roles: defaultRoles,
      notificationSettings: [{ projectId: '*', enabled: true }],
      notificationRules: defaultNotificationRules,
      notificationRecords: [],
      pendingNotifications: [],
      projectNotificationConfigs: [],

      currentProjectId: null,
      currentPage: 'dashboard',

      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setConflicts: (conflicts) => set({ conflicts }),

      addTask: (task) =>
        set((state) => {
          // When adding a task with predecessors, cascade dates immediately
          const newList = [...state.tasks, task];
          const newOrder = [...state.taskOrder, task.id];
          if (task.predecessors?.length) {
            return { tasks: cascadeTaskDates(task.id, newList), taskOrder: newOrder };
          }
          return { tasks: newList, taskOrder: newOrder };
        }),
      updateTask: (id, updates) =>
        set((state) => {
          const updatedList = state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          );
          // Cascade only when dates actually changed
          const datesChanged =
            updates.plannedEnd !== undefined ||
            updates.plannedStart !== undefined ||
            updates.predecessors !== undefined;
          if (datesChanged) {
            const cascaded = cascadeTaskDates(id, updatedList);

            // Active cascade rules (with project + minShift filtering)
            const cascadeRules = (state.notificationRules ?? defaultNotificationRules).filter(
              r => r.enabled && r.trigger === 'cascade'
            );

            const pending: PendingNotification[] = [];
            for (const newTask of cascaded) {
              if (newTask.id === id) continue;
              const oldTask = state.tasks.find(t => t.id === newTask.id);
              if (!oldTask) continue;
              if (newTask.plannedStart !== oldTask.plannedStart) {
                const oldD = new Date(oldTask.plannedStart).getTime();
                const newD = new Date(newTask.plannedStart).getTime();
                const shiftDays = Math.round((newD - oldD) / 86400000);

                // Check project-level notification config
                const projConfig = (state.projectNotificationConfigs ?? []).find(
                  c => c.projectId === newTask.projectId
                );
                if (projConfig && !projConfig.enabled) continue;

                // Find the first matching rule (also filtered by per-project rule selection)
                const matchingRule = cascadeRules.find(r => {
                  const projectOk = r.projectIds.length === 0 || r.projectIds.includes(newTask.projectId);
                  const ruleAllowedForProject =
                    !projConfig ||
                    projConfig.enabledRuleIds.length === 0 ||
                    projConfig.enabledRuleIds.includes(r.id);
                  const criticalOk = !r.criticalOnly || newTask.isCritical;
                  return projectOk && ruleAllowedForProject && criticalOk && Math.abs(shiftDays) >= r.minShiftDays;
                });
                if (!matchingRule) continue;

                pending.push({
                  taskId: newTask.id,
                  oldStart: oldTask.plannedStart,
                  newStart: newTask.plannedStart,
                  oldEnd: oldTask.plannedEnd,
                  newEnd: newTask.plannedEnd,
                  shiftDays,
                  ruleId: matchingRule.id,
                  notificationType: 'cascade',
                });
              }
            }

            return {
              tasks: cascaded,
              pendingNotifications: pending.length > 0 ? pending : state.pendingNotifications,
            };
          }
          return { tasks: updatedList };
        }),
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        taskOrder: state.taskOrder.filter(tid => tid !== id),
      })),
      setTaskOrder: (ids) => set({ taskOrder: ids }),

      addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deleteProject: (id) => set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

      addMilestone: (milestone) => set((state) => ({ milestones: [...state.milestones, milestone] })),
      updateMilestone: (id, updates) =>
        set((state) => ({
          milestones: state.milestones.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      deleteMilestone: (id) => set((state) => ({ milestones: state.milestones.filter((m) => m.id !== id) })),

      addRisk: (risk) => set((state) => ({ risks: [...state.risks, risk] })),
      updateRisk: (id, updates) =>
        set((state) => ({
          risks: state.risks.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteRisk: (id) => set((state) => ({ risks: state.risks.filter((r) => r.id !== id) })),

      addMobileReport: (report) =>
        set((state) => ({ mobileReports: [...state.mobileReports, report] })),

      addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      deleteTemplate: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),

      addPhase: (phase) => set((state) => ({ phases: [...state.phases, phase] })),
      updatePhase: (id, updates) =>
        set((state) => ({
          phases: state.phases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deletePhase: (id) => set((state) => ({ phases: state.phases.filter((p) => p.id !== id) })),

      addObject: (obj) => set((state) => ({ objects: [...state.objects, obj] })),
      updateObject: (id, updates) =>
        set((state) => ({
          objects: state.objects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),
      deleteObject: (id) => set((state) => ({ objects: state.objects.filter((o) => o.id !== id) })),

      addUser: (user) => set((state) => ({ users: [...state.users, user] })),
      updateUser: (id, updates) =>
        set((state) => ({ users: state.users.map((u) => (u.id === id ? { ...u, ...updates } : u)) })),
      deleteUser: (id) => set((state) => ({ users: state.users.filter((u) => u.id !== id) })),

      addProjectShare: (share) => set((state) => ({ projectShares: [...state.projectShares, share] })),
      deleteProjectShare: (id) => set((state) => ({ projectShares: state.projectShares.filter((s) => s.id !== id) })),

      setProjectCraftAssignment: (pa) => set((state) => {
        const filtered = state.projectCraftAssignments.filter(
          a => !(a.projectId === pa.projectId && a.craftId === pa.craftId)
        );
        return { projectCraftAssignments: pa.contractorId ? [...filtered, pa] : filtered };
      }),
      clearProjectCraftAssignment: (projectId, craftId) => set((state) => ({
        projectCraftAssignments: state.projectCraftAssignments.filter(
          a => !(a.projectId === projectId && a.craftId === craftId)
        ),
      })),

      addRole: (role) => set((state) => ({ roles: [...state.roles, role] })),
      updateRole: (id, updates) =>
        set((state) => ({ roles: state.roles.map((r) => (r.id === id ? { ...r, ...updates } : r)) })),
      deleteRole: (id) => set((state) => ({ roles: state.roles.filter((r) => r.id !== id) })),

      addLog: (log) => set((state) => ({ taskLogs: [...state.taskLogs, log] })),

      // Notification actions
      updateNotificationSettings: (projectId, enabled) =>
        set((state) => {
          const existing = state.notificationSettings.find(s => s.projectId === projectId);
          if (existing) {
            return {
              notificationSettings: state.notificationSettings.map(s =>
                s.projectId === projectId ? { ...s, enabled } : s
              ),
            };
          }
          return { notificationSettings: [...state.notificationSettings, { projectId, enabled }] };
        }),

      addNotificationRule: (rule) =>
        set((state) => ({ notificationRules: [...(state.notificationRules ?? []), rule] })),
      updateNotificationRule: (id, updates) =>
        set((state) => ({
          notificationRules: (state.notificationRules ?? []).map(r => r.id === id ? { ...r, ...updates } : r),
        })),
      deleteNotificationRule: (id) =>
        set((state) => ({ notificationRules: (state.notificationRules ?? []).filter(r => r.id !== id) })),

      addNotificationRecord: (record) =>
        set((state) => ({ notificationRecords: [record, ...state.notificationRecords] })),
      updateNotificationRecord: (id, updates) =>
        set((state) => ({
          notificationRecords: state.notificationRecords.map(r => r.id === id ? { ...r, ...updates } : r),
        })),
      clearPendingNotifications: () => set({ pendingNotifications: [] }),
      appendPendingNotifications: (items) =>
        set((state) => ({ pendingNotifications: [...state.pendingNotifications, ...items] })),
      syncConfirmations: (confirmed) =>
        set((state) => ({
          notificationRecords: state.notificationRecords.map(r => {
            const confirmedAt = confirmed[r.token];
            if (confirmedAt && r.status !== 'confirmed') {
              return { ...r, status: 'confirmed' as const, confirmedAt };
            }
            return r;
          }),
        })),

      setProjectNotificationConfig: (config) =>
        set((state) => {
          const existing = (state.projectNotificationConfigs ?? []).find(
            c => c.projectId === config.projectId
          );
          if (existing) {
            return {
              projectNotificationConfigs: (state.projectNotificationConfigs ?? []).map(c =>
                c.projectId === config.projectId ? { ...c, ...config } : c
              ),
            };
          }
          return {
            projectNotificationConfigs: [...(state.projectNotificationConfigs ?? []), config],
          };
        }),
    }),
    { name: 'construction-planner-store' }
  )
);
