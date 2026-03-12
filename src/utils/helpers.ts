export const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', minimumFractionDigits: 0 }).format(amount);
};

export const getDaysBetween = (start: string, end: string): number => {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
};

export const statusColor = (status: string): string => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    at_risk: 'bg-orange-100 text-orange-800',
    delayed: 'bg-red-100 text-red-800',
    not_started: 'bg-gray-100 text-gray-800',
    planning: 'bg-purple-100 text-purple-800',
    active: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-800',
    mitigated: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800',
    open: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const statusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    completed: 'Dokončeno',
    in_progress: 'Probíhá',
    at_risk: 'Riziko',
    delayed: 'Zpožděno',
    not_started: 'Nezahájeno',
    planning: 'Plánování',
    active: 'Aktivní',
    paused: 'Pozastaveno',
    pending: 'Čeká',
    mitigated: 'Zmírněno',
    closed: 'Uzavřeno',
    open: 'Otevřeno',
    paid: 'Zaplaceno',
    invoiced: 'Fakturováno',
    low: 'Nízká',
    medium: 'Střední',
    high: 'Vysoká',
    critical: 'Kritická',
    FS: 'Konec→Start',
    SS: 'Start→Start',
    FF: 'Konec→Konec',
  };
  return labels[status] || status;
};

export const priorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return colors[priority] || '';
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Snap a date forward to the nearest Monday–Friday workday.
// If already a workday, returns the date unchanged.
export const nextWorkday = (dateStr: string): string => {
  const d = new Date(dateStr);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};
