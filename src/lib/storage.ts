import type {
  TaxProfile,
  Deductions,
  ChecklistState,
  SavedRecord,
  AppMeta,
} from './types';
import { CHECKLIST_DEFAULTS } from './constants';

export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// ============================================================================
// Packet 0002: Domain-specific CRUD helpers
// ============================================================================

const KEYS = {
  profile: 'taxback:profile',
  deductions: 'taxback:deductions',
  checklist: 'taxback:checklist',
  records: 'taxback:records',
  meta: 'taxback:meta',
} as const;

const MAX_RECORDS = 5;

function defaultProfile(): TaxProfile {
  return {
    id: '',
    taxYear: new Date().getFullYear(),
    incomeType: 'employee',
    annualSalary: 0,
    freelanceIncome: 0,
    dependents: 0,
    updatedAt: 0,
  };
}

function defaultDeductions(): Deductions {
  return {
    creditCard: 0,
    medical: 0,
    education: 0,
    irp: 0,
    insurance: 0,
    donation: 0,
  };
}

function defaultChecklist(): ChecklistState {
  return {
    items: CHECKLIST_DEFAULTS,
    achievedCount: 0,
    totalCount: 6,
    updatedAt: 0,
  };
}

function defaultMeta(): AppMeta {
  return {
    disclaimerAcknowledged: false,
    lastVisitAt: 0,
    seasonBannerDismissedYear: null,
  };
}

function trySetItem<T>(key: string, value: T): boolean {
  try {
    setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getProfile(): TaxProfile | null {
  return getItem<TaxProfile>(KEYS.profile) ?? defaultProfile();
}

export function saveProfile(profile: TaxProfile): boolean {
  if (profile.annualSalary < 0 || profile.dependents > 10) return false;
  return trySetItem(KEYS.profile, profile);
}

export function getDeductions(): Deductions | null {
  return getItem<Deductions>(KEYS.deductions) ?? defaultDeductions();
}

export function saveDeductions(deductions: Deductions): boolean {
  return trySetItem(KEYS.deductions, deductions);
}

export function getChecklist(): ChecklistState | null {
  return getItem<ChecklistState>(KEYS.checklist) ?? defaultChecklist();
}

export function saveChecklist(checklist: ChecklistState): boolean {
  return trySetItem(KEYS.checklist, checklist);
}

export function getRecords(): SavedRecord[] {
  return getItem<SavedRecord[]>(KEYS.records) ?? [];
}

export function saveRecord(record: SavedRecord): boolean {
  const existing = getRecords();
  const next = [...existing, record];
  if (next.length > MAX_RECORDS) {
    next.sort((a, b) => a.savedAt - b.savedAt);
    next.splice(0, next.length - MAX_RECORDS);
  }
  return trySetItem(KEYS.records, next);
}

export function getMeta(): AppMeta | null {
  return getItem<AppMeta>(KEYS.meta) ?? defaultMeta();
}

export function saveMeta(meta: Partial<AppMeta>): boolean {
  const merged = { ...(getMeta() ?? defaultMeta()), ...meta };
  return trySetItem(KEYS.meta, merged);
}
