import type {
  TaxProfile,
  Deductions,
  ChecklistState,
  SavedRecord,
  AppMeta,
} from './types';

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

export function getProfile(): TaxProfile | null {
  throw new Error('not implemented');
}

export function saveProfile(profile: TaxProfile): boolean {
  throw new Error('not implemented');
}

export function getDeductions(): Deductions | null {
  throw new Error('not implemented');
}

export function saveDeductions(deductions: Deductions): boolean {
  throw new Error('not implemented');
}

export function getChecklist(): ChecklistState | null {
  throw new Error('not implemented');
}

export function saveChecklist(checklist: ChecklistState): boolean {
  throw new Error('not implemented');
}

export function getRecords(): SavedRecord[] {
  throw new Error('not implemented');
}

export function saveRecord(record: SavedRecord): boolean {
  throw new Error('not implemented');
}

export function getMeta(): AppMeta | null {
  throw new Error('not implemented');
}

export function saveMeta(meta: AppMeta): boolean {
  throw new Error('not implemented');
}
