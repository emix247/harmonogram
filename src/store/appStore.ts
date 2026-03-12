import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project, Task, Craft, Contractor, Milestone, Risk, Template,
  TaskLog, MobileReport, ConflictAlert, Company, User, Phase, ProjectObject, ProjectShare, Role, ProjectCraftAssignment
} from '../types';

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

// =================== SAMPLE DATA ===================

const sampleCompanies: Company[] = [
  {
    id: 'c1',
    name: 'TESGRUP s.r.o.',
    address: 'Brno, Náměstí Svobody 1',
    ico: '12345678',
    contactPerson: 'Ing. Jan Novák',
    email: 'novak@tesgrup.cz',
    phone: '+420 777 123 456',
  },
  {
    id: 'c2',
    name: 'STAVBY MORAVA a.s.',
    address: 'Ostrava, Masarykovo náměstí 5',
    ico: '87654321',
    contactPerson: 'Ing. Pavel Dvořák',
    email: 'dvorak@stavbymorava.cz',
    phone: '+420 776 987 654',
  },
];

const sampleContractors: Contractor[] = [
  {
    id: 'con1',
    name: 'Zemní práce Horák s.r.o.',
    address: 'Hodonín, Průmyslová 12',
    ico: '11223344',
    contactPerson: 'Tomáš Horák',
    email: 'horak@zemine.cz',
    phone: '+420 775 111 222',
    crafts: ['craft1'],
    tags: ['Zemní práce', 'Výkopové práce', 'Terénní úpravy'],
  },
  {
    id: 'con2',
    name: 'Zednictví Procházka',
    address: 'Brno, Stavební 45',
    ico: '55667788',
    contactPerson: 'Karel Procházka',
    email: 'prochazka@zednictvi.cz',
    phone: '+420 774 333 444',
    crafts: ['craft2'],
    tags: ['Zdění', 'Omítky', 'Podlahy', 'Malba a tapety'],
  },
  {
    id: 'con3',
    name: 'Tesařství Kovář',
    address: 'Znojmo, Lesní 7',
    ico: '99001122',
    contactPerson: 'Martin Kovář',
    email: 'kovar@tesarstvi.cz',
    phone: '+420 773 555 666',
    crafts: ['craft3'],
    tags: ['Tesařství', 'Pokrývačství', 'Lešenářství', 'Bednění'],
  },
  {
    id: 'con4',
    name: 'Elektro Malý s.r.o.',
    address: 'Brno, Elektrická 22',
    ico: '33445566',
    contactPerson: 'Petr Malý',
    email: 'maly@elektro.cz',
    phone: '+420 772 777 888',
    crafts: ['craft5'],
    tags: ['Elektroinstalace', 'Slaboproud', 'Instalace (ZTI)', 'Vodo-topo'],
  },
];

const sampleCrafts: Craft[] = [
  { id: 'craft1', name: 'Zemní práce', description: 'Výkopy, terénní úpravy', availableTeams: 2, contractorId: 'con1', contactPerson: 'Tomáš Horák', phone: '+420 775 111 222', color: '#8B4513' },
  { id: 'craft2', name: 'Zdění', description: 'Zděné konstrukce, příčky', availableTeams: 3, contractorId: 'con2', contactPerson: 'Karel Procházka', phone: '+420 774 333 444', color: '#CD853F' },
  { id: 'craft3', name: 'Tesařství', description: 'Dřevěné konstrukce, krovy', availableTeams: 2, contractorId: 'con3', contactPerson: 'Martin Kovář', phone: '+420 773 555 666', color: '#DEB887' },
  { id: 'craft4', name: 'Pokrývačství', description: 'Střešní krytiny, klempířství', availableTeams: 1, contractorId: 'con3', contactPerson: 'Martin Kovář', phone: '+420 773 555 666', color: '#708090' },
  { id: 'craft5', name: 'Elektroinstalace', description: 'Silnoproud, slaboproud', availableTeams: 2, contractorId: 'con4', contactPerson: 'Petr Malý', phone: '+420 772 777 888', color: '#FFD700' },
  { id: 'craft6', name: 'Instalace (ZTI)', description: 'Vodovod, kanalizace, topení', availableTeams: 2, contractorId: 'con4', contactPerson: 'Petr Malý', phone: '+420 772 777 888', color: '#4169E1' },
  { id: 'craft7', name: 'Omítky', description: 'Vnitřní a vnější omítky', availableTeams: 2, contractorId: 'con2', contactPerson: 'Karel Procházka', phone: '+420 774 333 444', color: '#F5DEB3' },
  { id: 'craft8', name: 'Podlahy', description: 'Podlahové krytiny, potěry', availableTeams: 1, contractorId: 'con2', contactPerson: 'Karel Procházka', phone: '+420 774 333 444', color: '#D2691E' },
  { id: 'craft9', name: 'Malba a tapety', description: 'Nátěry, tapetování', availableTeams: 2, contractorId: 'con2', contactPerson: 'Karel Procházka', phone: '+420 774 333 444', color: '#98FB98' },
];

const sampleUsers: User[] = [
  { id: 'u1', name: 'Ing. Jan Novák', email: 'novak@tesgrup.cz', role: 'admin', companyId: 'c1', loginName: 'admin', password: 'tesgrup2024' },
  { id: 'u2', name: 'Bc. Marie Svobodová', email: 'svobodova@tesgrup.cz', role: 'project_manager', companyId: 'c1' },
  { id: 'u3', name: 'Pavel Čermák', email: 'cermak@tesgrup.cz', role: 'site_manager', companyId: 'c1' },
  { id: 'u4', name: 'Lucie Horáčková', email: 'horáčková@tesgrup.cz', role: 'viewer', companyId: 'c1' },
];

const samplePhases: Phase[] = [
  { id: 'ph1', name: 'Hrubá stavba', projectId: 'p1', order: 1, color: '#f97316' },
  { id: 'ph2', name: 'Střecha', projectId: 'p1', order: 2, color: '#8b5cf6' },
  { id: 'ph3', name: 'Vnitřní práce', projectId: 'p1', order: 3, color: '#3b82f6' },
  { id: 'ph4', name: 'Dokončovací práce', projectId: 'p1', order: 4, color: '#10b981' },
  { id: 'ph5', name: 'Hrubá stavba', projectId: 'p2', order: 1, color: '#f97316' },
  { id: 'ph6', name: 'Vnitřní práce', projectId: 'p2', order: 2, color: '#3b82f6' },
];

const sampleObjects: ProjectObject[] = [
  { id: 'obj1', name: 'Dům č. 1', projectId: 'p1', phaseId: 'ph1', description: 'Rodinný dům typ A' },
  { id: 'obj2', name: 'Dům č. 2', projectId: 'p1', phaseId: 'ph1', description: 'Rodinný dům typ A' },
  { id: 'obj3', name: 'Dům č. 3', projectId: 'p1', phaseId: 'ph1', description: 'Rodinný dům typ B' },
  { id: 'obj4', name: 'Blok A', projectId: 'p2', phaseId: 'ph5', description: 'Bytový dům 8 bytů' },
  { id: 'obj5', name: 'Blok B', projectId: 'p2', phaseId: 'ph5', description: 'Bytový dům 8 bytů' },
];

const sampleProjects: Project[] = [
  {
    id: 'p1',
    name: 'Dubňany – 19 rodinných domů',
    companyId: 'c1',
    description: 'Výstavba 19 rodinných domů v lokalitě Dubňany, okr. Hodonín',
    plannedStart: '2026-03-01',
    plannedEnd: '2026-12-31',
    actualStart: '2026-03-10',
    status: 'active',
    budget: 45000000,
    phases: samplePhases.filter(p => p.projectId === 'p1'),
    objects: sampleObjects.filter(o => o.projectId === 'p1'),
    managerId: 'u2',
    address: 'Dubňany, okr. Hodonín',
    color: '#3b82f6',
  },
  {
    id: 'p2',
    name: 'Ostrava – Bytový komplex Západ',
    companyId: 'c2',
    description: 'Bytový komplex 2 bloků po 8 bytech v Ostravě-Západ',
    plannedStart: '2026-04-01',
    plannedEnd: '2027-06-30',
    status: 'planning',
    budget: 82000000,
    phases: samplePhases.filter(p => p.projectId === 'p2'),
    objects: sampleObjects.filter(o => o.projectId === 'p2'),
    managerId: 'u2',
    address: 'Ostrava-Západ, Průvozní 45',
    color: '#8b5cf6',
  },
];

const today = new Date();
const addDaysToDate = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const sampleTasks: Task[] = [
  {
    id: 't1',
    name: 'Výkop základové desky – Dům č. 1',
    description: 'Výkop pro základovou desku včetně odvezení zeminy',
    projectId: 'p1',
    phaseId: 'ph1',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, -20),
    plannedEnd: addDaysToDate(today, -15),
    plannedDuration: 5,
    actualStart: addDaysToDate(today, -20),
    actualEnd: addDaysToDate(today, -14),
    actualDuration: 6,
    predecessors: [],
    successors: ['t2'],
    craftId: 'craft1',
    contractorId: 'con1',
    responsiblePersonId: 'u3',
    priority: 'high',
    progressPercent: 100,
    status: 'completed',
    notes: 'Dokončeno s jednodením zpožděním',
    attachments: [],
    isCritical: true,
    plannedCost: 120000,
    paymentStatus: 'paid',
  },
  {
    id: 't2',
    name: 'Základová deska – Dům č. 1',
    description: 'Bednění, výztuž a betonáž základové desky',
    projectId: 'p1',
    phaseId: 'ph1',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, -14),
    plannedEnd: addDaysToDate(today, -7),
    plannedDuration: 7,
    actualStart: addDaysToDate(today, -13),
    predecessors: [{ taskId: 't1', type: 'FS' }],
    successors: ['t3'],
    craftId: 'craft2',
    contractorId: 'con2',
    responsiblePersonId: 'u3',
    priority: 'high',
    progressPercent: 85,
    status: 'in_progress',
    notes: '',
    attachments: [],
    isCritical: true,
    plannedCost: 280000,
    paymentStatus: 'invoiced',
  },
  {
    id: 't3',
    name: 'Zdivo přízemí – Dům č. 1',
    description: 'Nosné zdivo 1. NP z tvárnic Ytong',
    projectId: 'p1',
    phaseId: 'ph1',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, -6),
    plannedEnd: addDaysToDate(today, 8),
    plannedDuration: 14,
    predecessors: [{ taskId: 't2', type: 'FS' }],
    successors: ['t4'],
    craftId: 'craft2',
    contractorId: 'con2',
    responsiblePersonId: 'u3',
    priority: 'high',
    progressPercent: 40,
    status: 'in_progress',
    notes: '',
    attachments: [],
    isCritical: true,
    plannedCost: 450000,
    paymentStatus: 'pending',
  },
  {
    id: 't4',
    name: 'Strop 1. NP – Dům č. 1',
    description: 'Montáž stropních panelů Spiroll',
    projectId: 'p1',
    phaseId: 'ph1',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, 9),
    plannedEnd: addDaysToDate(today, 16),
    plannedDuration: 7,
    predecessors: [{ taskId: 't3', type: 'FS' }],
    successors: ['t5'],
    craftId: 'craft2',
    contractorId: 'con2',
    responsiblePersonId: 'u3',
    priority: 'high',
    progressPercent: 0,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: true,
    plannedCost: 320000,
    paymentStatus: 'pending',
  },
  {
    id: 't5',
    name: 'Krovová konstrukce – Dům č. 1',
    description: 'Tesařské práce – krov sedlové střechy',
    projectId: 'p1',
    phaseId: 'ph2',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, 17),
    plannedEnd: addDaysToDate(today, 27),
    plannedDuration: 10,
    predecessors: [{ taskId: 't4', type: 'FS' }],
    successors: ['t6'],
    craftId: 'craft3',
    contractorId: 'con3',
    responsiblePersonId: 'u3',
    priority: 'high',
    progressPercent: 0,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 190000,
    paymentStatus: 'pending',
  },
  {
    id: 't6',
    name: 'Střešní krytina – Dům č. 1',
    description: 'Položení střešní krytiny, klempířské prvky',
    projectId: 'p1',
    phaseId: 'ph2',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, 28),
    plannedEnd: addDaysToDate(today, 35),
    plannedDuration: 7,
    predecessors: [{ taskId: 't5', type: 'FS' }],
    successors: ['t7'],
    craftId: 'craft4',
    contractorId: 'con3',
    responsiblePersonId: 'u3',
    priority: 'medium',
    progressPercent: 0,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 145000,
    paymentStatus: 'pending',
  },
  {
    id: 't7',
    name: 'Elektroinstalace – Dům č. 1',
    description: 'Hrubá elektroinstalace, rozvody',
    projectId: 'p1',
    phaseId: 'ph3',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, 36),
    plannedEnd: addDaysToDate(today, 47),
    plannedDuration: 11,
    predecessors: [{ taskId: 't6', type: 'FS' }],
    successors: ['t8'],
    craftId: 'craft5',
    contractorId: 'con4',
    responsiblePersonId: 'u3',
    priority: 'medium',
    progressPercent: 0,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 210000,
    paymentStatus: 'pending',
  },
  {
    id: 't8',
    name: 'Instalace ZTI – Dům č. 1',
    description: 'Rozvody vody, kanalizace, vytápění',
    projectId: 'p1',
    phaseId: 'ph3',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, 36),
    plannedEnd: addDaysToDate(today, 50),
    plannedDuration: 14,
    predecessors: [{ taskId: 't6', type: 'FS' }],
    successors: ['t9'],
    craftId: 'craft6',
    contractorId: 'con4',
    responsiblePersonId: 'u3',
    priority: 'medium',
    progressPercent: 0,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 380000,
    paymentStatus: 'pending',
  },
  {
    id: 't9',
    name: 'Omítky – Dům č. 1',
    description: 'Vnitřní omítky strojní',
    projectId: 'p1',
    phaseId: 'ph3',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, 51),
    plannedEnd: addDaysToDate(today, 62),
    plannedDuration: 11,
    predecessors: [{ taskId: 't8', type: 'FS' }],
    successors: ['t10'],
    craftId: 'craft7',
    contractorId: 'con2',
    responsiblePersonId: 'u3',
    priority: 'medium',
    progressPercent: 0,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 160000,
    paymentStatus: 'pending',
  },
  {
    id: 't10',
    name: 'Podlahy a obklady – Dům č. 1',
    description: 'Potěry, dlažby, obklady',
    projectId: 'p1',
    phaseId: 'ph4',
    objectId: 'obj1',
    plannedStart: addDaysToDate(today, 63),
    plannedEnd: addDaysToDate(today, 77),
    plannedDuration: 14,
    predecessors: [{ taskId: 't9', type: 'FS' }],
    successors: [],
    craftId: 'craft8',
    contractorId: 'con2',
    responsiblePersonId: 'u3',
    priority: 'low',
    progressPercent: 0,
    status: 'not_started',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 280000,
    paymentStatus: 'pending',
  },
  {
    id: 't11',
    name: 'Výkop základové desky – Dům č. 2',
    description: 'Výkop pro základovou desku včetně odvezení zeminy',
    projectId: 'p1',
    phaseId: 'ph1',
    objectId: 'obj2',
    plannedStart: addDaysToDate(today, -10),
    plannedEnd: addDaysToDate(today, -5),
    plannedDuration: 5,
    predecessors: [],
    successors: ['t12'],
    craftId: 'craft1',
    contractorId: 'con1',
    responsiblePersonId: 'u3',
    priority: 'high',
    progressPercent: 100,
    status: 'completed',
    notes: '',
    attachments: [],
    isCritical: false,
    plannedCost: 120000,
    paymentStatus: 'paid',
  },
  {
    id: 't12',
    name: 'Základová deska – Dům č. 2',
    description: 'Bednění, výztuž a betonáž základové desky',
    projectId: 'p1',
    phaseId: 'ph1',
    objectId: 'obj2',
    plannedStart: addDaysToDate(today, -4),
    plannedEnd: addDaysToDate(today, 3),
    plannedDuration: 7,
    predecessors: [{ taskId: 't11', type: 'FS' }],
    successors: [],
    craftId: 'craft2',
    contractorId: 'con2',
    responsiblePersonId: 'u3',
    priority: 'high',
    progressPercent: 60,
    status: 'in_progress',
    notes: 'Probíhá betonáž',
    attachments: [],
    isCritical: false,
    plannedCost: 280000,
    paymentStatus: 'pending',
  },
];

const sampleMilestones: Milestone[] = [
  {
    id: 'm1',
    name: 'Zahájení výstavby',
    projectId: 'p1',
    plannedDate: addDaysToDate(today, -20),
    actualDate: addDaysToDate(today, -20),
    status: 'completed',
    description: 'Předání staveniště, zahájení zemních prací',
    color: '#10b981',
  },
  {
    id: 'm2',
    name: 'Dokončení hrubé stavby – Dům č. 1',
    projectId: 'p1',
    plannedDate: addDaysToDate(today, 16),
    status: 'pending',
    description: 'Dokončení hrubé stavby prvního domu',
    color: '#f97316',
  },
  {
    id: 'm3',
    name: 'Dokončení střechy – Dům č. 1',
    projectId: 'p1',
    plannedDate: addDaysToDate(today, 35),
    status: 'pending',
    description: 'Střecha hotova, dům pod střechou',
    color: '#8b5cf6',
  },
  {
    id: 'm4',
    name: 'Kolaudace – Dům č. 1',
    projectId: 'p1',
    plannedDate: addDaysToDate(today, 90),
    status: 'pending',
    description: 'Kolaudační souhlas a předání prvního domu klientovi',
    color: '#3b82f6',
  },
];

const sampleRisks: Risk[] = [
  {
    id: 'r1',
    projectId: 'p1',
    taskId: 't3',
    title: 'Nedostatek pracovní síly – zdění',
    description: 'Zednická parta pracuje na dvou projektech současně, hrozí kapacitní konflikt',
    probability: 'medium',
    impact: 'high',
    status: 'open',
    mitigationPlan: 'Domluvit s Procházkou prioritu projektu Dubňany, případně zajistit druhou partu',
    detectedAt: addDaysToDate(today, -3),
    owner: 'Ing. Jan Novák',
  },
  {
    id: 'r2',
    projectId: 'p1',
    title: 'Prodloužení dodávky stropních panelů',
    description: 'Výrobce Spiroll hlásí 2 týdenní zpoždění dodávky',
    probability: 'high',
    impact: 'high',
    status: 'open',
    mitigationPlan: 'Prověřit alternativní dodavatele (Prefa Brno, Goldbeck)',
    detectedAt: addDaysToDate(today, -1),
    owner: 'Bc. Marie Svobodová',
  },
  {
    id: 'r3',
    projectId: 'p1',
    title: 'Nepříznivé počasí',
    description: 'Předpověď mrazu na příštích 10 dní, hrozí problémy s betonáží',
    probability: 'medium',
    impact: 'medium',
    status: 'open',
    mitigationPlan: 'Připravit zimní opatření – ohřev betonu, zakrytí',
    detectedAt: addDaysToDate(today, 0),
    owner: 'Pavel Čermák',
  },
];

const sampleTemplates: Template[] = [
  {
    id: 'tmpl1',
    name: 'Zděný rodinný dům',
    description: 'Standardní šablona pro výstavbu zděného rodinného domu',
    category: 'Rodinný dům',
    estimatedDuration: 180,
    color: '#3b82f6',
    tasks: [
      { name: 'Výkop základů', plannedDuration: 5, craftId: 'craft1' },
      { name: 'Základová deska', plannedDuration: 7, craftId: 'craft2' },
      { name: 'Zdivo přízemí', plannedDuration: 14, craftId: 'craft2' },
      { name: 'Strop 1. NP', plannedDuration: 7, craftId: 'craft2' },
      { name: 'Zdivo 1. patra', plannedDuration: 14, craftId: 'craft2' },
      { name: 'Strop 2. NP', plannedDuration: 7, craftId: 'craft2' },
      { name: 'Krov', plannedDuration: 10, craftId: 'craft3' },
      { name: 'Střešní krytina', plannedDuration: 7, craftId: 'craft4' },
      { name: 'Elektroinstalace hrubá', plannedDuration: 11, craftId: 'craft5' },
      { name: 'Instalace ZTI', plannedDuration: 14, craftId: 'craft6' },
      { name: 'Omítky', plannedDuration: 11, craftId: 'craft7' },
      { name: 'Podlahy', plannedDuration: 14, craftId: 'craft8' },
      { name: 'Malba', plannedDuration: 7, craftId: 'craft9' },
    ],
  },
  {
    id: 'tmpl2',
    name: 'Dřevostavba',
    description: 'Šablona pro montovanou dřevostavbu',
    category: 'Rodinný dům',
    estimatedDuration: 120,
    color: '#DEB887',
    tasks: [
      { name: 'Výkop základů', plannedDuration: 5, craftId: 'craft1' },
      { name: 'Základová deska', plannedDuration: 7, craftId: 'craft2' },
      { name: 'Montáž nosné konstrukce', plannedDuration: 7, craftId: 'craft3' },
      { name: 'Střecha', plannedDuration: 10, craftId: 'craft3' },
      { name: 'Fasáda', plannedDuration: 7, craftId: 'craft3' },
      { name: 'Elektroinstalace', plannedDuration: 8, craftId: 'craft5' },
      { name: 'Instalace ZTI', plannedDuration: 10, craftId: 'craft6' },
      { name: 'Podlahy', plannedDuration: 7, craftId: 'craft8' },
    ],
  },
  {
    id: 'tmpl3',
    name: 'Bytový dům',
    description: 'Šablona pro bytový dům do 8 bytových jednotek',
    category: 'Bytový dům',
    estimatedDuration: 365,
    color: '#8b5cf6',
    tasks: [
      { name: 'Zemní práce', plannedDuration: 14, craftId: 'craft1' },
      { name: 'Základy', plannedDuration: 21, craftId: 'craft2' },
      { name: 'Nosná konstrukce', plannedDuration: 60, craftId: 'craft2' },
      { name: 'Střecha', plannedDuration: 21, craftId: 'craft4' },
      { name: 'Elektroinstalace', plannedDuration: 30, craftId: 'craft5' },
      { name: 'Instalace ZTI', plannedDuration: 35, craftId: 'craft6' },
      { name: 'Omítky', plannedDuration: 28, craftId: 'craft7' },
      { name: 'Podlahy', plannedDuration: 21, craftId: 'craft8' },
      { name: 'Malba', plannedDuration: 14, craftId: 'craft9' },
    ],
  },
  {
    id: 'tmpl4',
    name: 'Garáž / Garážový blok',
    description: 'Šablona pro výstavbu řadových garáží',
    category: 'Ostatní',
    estimatedDuration: 45,
    color: '#6b7280',
    tasks: [
      { name: 'Výkop', plannedDuration: 3, craftId: 'craft1' },
      { name: 'Základy', plannedDuration: 5, craftId: 'craft2' },
      { name: 'Zdivo', plannedDuration: 10, craftId: 'craft2' },
      { name: 'Střecha', plannedDuration: 7, craftId: 'craft4' },
      { name: 'Omítky exteriér', plannedDuration: 5, craftId: 'craft7' },
    ],
  },
];

const sampleTaskLogs: TaskLog[] = [
  {
    id: 'log1',
    taskId: 't1',
    projectId: 'p1',
    userId: 'u3',
    action: 'dokončení',
    description: 'Úkol označen jako dokončený',
    timestamp: addDaysToDate(today, -14) + 'T14:30:00',
    oldValue: 'v_průběhu',
    newValue: 'dokončeno',
  },
  {
    id: 'log2',
    taskId: 't2',
    projectId: 'p1',
    userId: 'u3',
    action: 'zahájení',
    description: 'Zahájeny práce na základové desce',
    timestamp: addDaysToDate(today, -13) + 'T07:15:00',
  },
  {
    id: 'log3',
    taskId: 't3',
    projectId: 'p1',
    userId: 'u3',
    action: 'zahájení',
    description: 'Zahájeny zednické práce – zdivo přízemí',
    timestamp: addDaysToDate(today, -7) + 'T08:00:00',
  },
];

const sampleMobileReports: MobileReport[] = [
  {
    id: 'mr1',
    taskId: 't3',
    projectId: 'p1',
    reporterId: 'u3',
    type: 'progress',
    description: 'Zdivo probíhá dle plánu. Hotovo přibližně 40% celkového zdiva přízemí.',
    photos: [],
    timestamp: addDaysToDate(today, 0) + 'T11:30:00',
    progressPercent: 40,
  },
  {
    id: 'mr2',
    taskId: 't2',
    projectId: 'p1',
    reporterId: 'u3',
    type: 'problem',
    description: 'Nalezena trhlina v základové desce na severní straně. Nutná konzultace statika.',
    photos: [],
    timestamp: addDaysToDate(today, -2) + 'T13:45:00',
  },
];

const sampleConflicts: ConflictAlert[] = [
  {
    id: 'conf1',
    type: 'overlap',
    craftId: 'craft2',
    taskIds: ['t2', 't12'],
    description: 'Zednická četa Procházka je plánována na dvou stavbách současně (Dům č. 1 a Dům č. 2)',
    severity: 'warning',
    date: addDaysToDate(today, 0),
  },
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
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      companies: sampleCompanies,
      users: sampleUsers,
      projects: sampleProjects,
      tasks: sampleTasks,
      crafts: sampleCrafts,
      contractors: sampleContractors,
      milestones: sampleMilestones,
      risks: sampleRisks,
      templates: sampleTemplates,
      taskLogs: sampleTaskLogs,
      mobileReports: sampleMobileReports,
      conflicts: sampleConflicts,
      phases: samplePhases,
      objects: sampleObjects,
      projectShares: [],
      projectCraftAssignments: [],
      taskOrder: sampleTasks.map(t => t.id),
      roles: defaultRoles,

      currentProjectId: 'p1',
      currentPage: 'dashboard',

      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setCurrentPage: (page) => set({ currentPage: page }),

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
            return { tasks: cascadeTaskDates(id, updatedList) };
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
    }),
    { name: 'construction-planner-store' }
  )
);
