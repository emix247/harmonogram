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
