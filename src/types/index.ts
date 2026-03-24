export type DependencyType = 'FS' | 'SS' | 'FF'; // Finish-to-Start, Start-to-Start, Finish-to-Finish

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'at_risk';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type UserRole = string;

export interface Role {
  id: string;
  label: string;
  color: string; // tailwind badge classes e.g. 'bg-red-100 text-red-700'
  builtIn?: boolean;
}

export type PaymentStatus = 'pending' | 'invoiced' | 'paid';

export interface Company {
  id: string;
  name: string;
  address: string;
  ico: string;
  contactPerson: string;
  email: string;
  phone: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  loginName?: string;
  password?: string;
}

export interface ProjectShare {
  id: string;
  projectId: string;
  token: string;
  label?: string;
  createdAt: string;
}

// Maps which contractor handles a given craft on a given project
export interface ProjectCraftAssignment {
  projectId: string;
  craftId: string;
  contractorId: string;
}

export interface Craft {
  id: string;
  name: string;
  description: string;
  availableTeams: number;
  contractorId: string;
  contactPerson: string;
  phone: string;
  color: string;
}

export interface ContractorContact {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface Contractor {
  id: string;
  name: string;
  address: string;
  ico: string;
  contactPerson: string;
  email: string;
  phone: string;
  crafts: string[];
  tags?: string[];
  notes?: string;
  contacts?: ContractorContact[];
}

export interface Dependency {
  taskId: string;
  type: DependencyType;
  lag?: number; // days
}

export interface Task {
  id: string;
  name: string;
  description: string;
  projectId: string;
  phaseId: string;
  objectId: string;
  plannedStart: string;
  plannedEnd: string;
  plannedDuration: number;
  actualStart?: string;
  actualEnd?: string;
  actualDuration?: number;
  predecessors: Dependency[];
  successors: string[];
  craftId: string;
  contractorId: string;
  responsiblePersonId: string;
  priority: Priority;
  progressPercent: number;
  autoProgress?: boolean;
  status: TaskStatus;
  notes: string;
  attachments: string[];
  isCritical: boolean;
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloat?: number;
  plannedCost?: number;
  invoiceDate?: string;
  paymentStatus?: PaymentStatus;
}

export interface Milestone {
  id: string;
  name: string;
  projectId: string;
  plannedDate: string;
  actualDate?: string;
  status: 'pending' | 'completed' | 'delayed';
  description: string;
  color: string;
}

export interface Phase {
  id: string;
  name: string;
  projectId: string;
  order: number;
  color: string;
  description?: string;
  plannedStart?: string;
  plannedEnd?: string;
}

export interface ProjectObject {
  id: string;
  name: string;
  projectId: string;
  phaseId?: string;
  description?: string;
  plannedStart?: string;
  plannedEnd?: string;
}

export interface Project {
  id: string;
  name: string;
  companyId: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'planning' | 'active' | 'completed' | 'paused';
  budget: number;
  phases: Phase[];
  objects: ProjectObject[];
  managerId: string;
  address: string;
  color: string;
}

export interface Risk {
  id: string;
  projectId: string;
  taskId?: string;
  title: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  status: 'open' | 'mitigated' | 'closed';
  mitigationPlan: string;
  detectedAt: string;
  owner: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tasks: Partial<Task>[];
  estimatedDuration: number;
  color: string;
}

export interface TaskLog {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  action: string;
  description: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
}

export interface MobileReport {
  id: string;
  taskId: string;
  projectId: string;
  reporterId: string;
  type: 'start' | 'finish' | 'progress' | 'problem' | 'note';
  description: string;
  photos: string[];
  timestamp: string;
  progressPercent?: number;
}

export interface ConflictAlert {
  id: string;
  type: 'capacity' | 'overlap' | 'unavailable';
  craftId: string;
  taskIds: string[];
  description: string;
  severity: 'warning' | 'error';
  date: string;
}

// =================== NOTIFICATION TYPES ===================

/** @deprecated use NotificationRule instead */
export interface NotificationSettings {
  projectId: string;
  enabled: boolean;
}

export type NotificationStatus = 'sent' | 'confirmed' | 'error';
export type NotificationTrigger = 'cascade' | 'deadline_reminder' | 'internal_reminder';

/** A configurable notification rule — one rule = one email template + trigger config */
export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: NotificationTrigger;

  // cascade: only fire when |shiftDays| >= minShiftDays (default 1)
  minShiftDays: number;
  // cascade: when true, only send notifications for critical tasks
  criticalOnly?: boolean;
  // deadline_reminder: fire N days before task.plannedEnd
  daysBeforeDeadline: number;

  // project filter — empty array = all projects
  projectIds: string[];

  // email template — all fields support {{variables}}
  emailSubject: string;
  emailIntro: string;      // paragraph shown before the date table
  emailFooter: string;
  emailNote: string;       // small note below confirm button (e.g. contact info)
  showConfirmButton: boolean;
  ccEmails: string[];
  // internal_reminder specific
  internalEmails?: string[];   // recipients (not contractor) — for internal_reminder
  internalTaskIds?: string[];  // specific task IDs to watch (empty = all in projectIds)
}

export interface NotificationRecord {
  id: string;
  taskId: string;
  projectId: string;
  taskName: string;
  contractorId: string;
  contractorName: string;
  contractorEmail: string;
  oldStart: string;
  newStart: string;
  oldEnd: string;
  newEnd: string;
  shiftDays: number;
  token: string;
  sentAt: string;
  status: NotificationStatus;
  confirmedAt?: string;
  ruleId?: string;
  notificationType?: NotificationTrigger;
  errorMessage?: string;
}

/** Tasks waiting to be notified — produced by updateTask / DeadlineReminderProcessor, consumed by NotificationProcessor */
export interface PendingNotification {
  taskId: string;
  oldStart: string;
  newStart: string;
  oldEnd: string;
  newEnd: string;
  shiftDays: number;
  ruleId?: string;
  notificationType?: NotificationTrigger;
}

/** Per-project notification configuration — master on/off + which rules apply */
export interface ProjectNotificationConfig {
  projectId: string;
  enabled: boolean;           // master on/off for all notifications in this project
  enabledRuleIds: string[];   // empty = all active rules apply, otherwise only these rule IDs
}
