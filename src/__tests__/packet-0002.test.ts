/**
 * Packet 0002: localStorage CRUD 헬퍼 테스트
 *
 * TDD Red Phase — 모든 테스트는 실패 (구현 미존재)
 * 각 AC마다 최소 1개 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  TaxProfile,
  Deductions,
  ChecklistState,
  SavedRecord,
  AppMeta,
} from '@/lib/types';

// TODO: Coder가 작성할 함수들
// import {
//   getProfile,
//   saveProfile,
//   getDeductions,
//   saveDeductions,
//   getChecklist,
//   saveChecklist,
//   getRecords,
//   saveRecord,
//   getMeta,
//   saveMeta,
// } from '@/lib/storage';

describe('Packet-0002: localStorage CRUD 헬퍼', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ============================================================================
  // AC-1: Export validation — 모든 CRUD 함수가 export됨
  // ============================================================================
  describe('AC-1: All CRUD functions are exported', () => {
    it('should export getProfile, saveProfile, getDeductions, saveDeductions, getChecklist, saveChecklist, getRecords, saveRecord, getMeta, saveMeta', async () => {
      // TODO: Coder가 src/lib/storage.ts에서 이 함수들을 export
      const storage = await import('@/lib/storage');
      expect(storage.getProfile).toBeDefined();
      expect(typeof storage.getProfile).toBe('function');
      expect(storage.saveProfile).toBeDefined();
      expect(typeof storage.saveProfile).toBe('function');
      expect(storage.getDeductions).toBeDefined();
      expect(typeof storage.getDeductions).toBe('function');
      expect(storage.saveDeductions).toBeDefined();
      expect(typeof storage.saveDeductions).toBe('function');
      expect(storage.getChecklist).toBeDefined();
      expect(typeof storage.getChecklist).toBe('function');
      expect(storage.saveChecklist).toBeDefined();
      expect(typeof storage.saveChecklist).toBe('function');
      expect(storage.getRecords).toBeDefined();
      expect(typeof storage.getRecords).toBe('function');
      expect(storage.saveRecord).toBeDefined();
      expect(typeof storage.saveRecord).toBe('function');
      expect(storage.getMeta).toBeDefined();
      expect(typeof storage.getMeta).toBe('function');
      expect(storage.saveMeta).toBeDefined();
      expect(typeof storage.saveMeta).toBe('function');
    });
  });

  // ============================================================================
  // AC-2: saveProfile validation — annualSalary < 0 또는 dependents > 10이면
  //       저장 안 하고 false 반환
  // ============================================================================
  describe('AC-2: saveProfile validation', () => {
    it('AC-2.1: should save valid profile and return true', async () => {
      const { saveProfile, getProfile } = await import('@/lib/storage');
      const profile: TaxProfile = {
        id: 'test-001',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 50000000,
        freelanceIncome: 0,
        dependents: 1,
        updatedAt: Date.now(),
      };

      const result = saveProfile(profile);
      expect(result).toBe(true);
      const retrieved = getProfile();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.annualSalary).toBe(50000000);
      expect(retrieved?.dependents).toBe(1);
    });

    it('AC-2.2: should reject profile with negative annualSalary and return false', async () => {
      const { saveProfile, getProfile } = await import('@/lib/storage');
      const invalidProfile: TaxProfile = {
        id: 'test-002',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: -1000000, // Invalid: negative
        freelanceIncome: 0,
        dependents: 0,
        updatedAt: Date.now(),
      };

      const result = saveProfile(invalidProfile);
      expect(result).toBe(false);
      const retrieved = getProfile();
      expect(retrieved?.annualSalary).not.toBe(-1000000);
    });

    it('AC-2.3: should reject profile with dependents > 10 and return false', async () => {
      const { saveProfile, getProfile } = await import('@/lib/storage');
      const invalidProfile: TaxProfile = {
        id: 'test-003',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 50000000,
        freelanceIncome: 0,
        dependents: 11, // Invalid: > 10
        updatedAt: Date.now(),
      };

      const result = saveProfile(invalidProfile);
      expect(result).toBe(false);
      const retrieved = getProfile();
      expect(retrieved?.dependents).not.toBe(11);
    });

    it('AC-2.4: should allow profile with dependents === 10', async () => {
      const { saveProfile, getProfile } = await import('@/lib/storage');
      const profile: TaxProfile = {
        id: 'test-004',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 50000000,
        freelanceIncome: 0,
        dependents: 10, // Valid: exactly 10
        updatedAt: Date.now(),
      };

      const result = saveProfile(profile);
      expect(result).toBe(true);
      const retrieved = getProfile();
      expect(retrieved?.dependents).toBe(10);
    });
  });

  // ============================================================================
  // AC-3: saveRecord — 6번째 저장 시 savedAt 최소 레코드 제거 후 최대 5개 유지
  //       QuotaExceededError면 false 반환·크래시 없음
  // ============================================================================
  describe('AC-3: saveRecord FIFO with max 5 records', () => {
    it('AC-3.1: should maintain max 5 records, removing oldest when saving 6th', async () => {
      const { saveRecord, getRecords } = await import('@/lib/storage');

      // Create 6 records with different savedAt timestamps
      const baseTime = 1000000;
      const records: SavedRecord[] = Array.from({ length: 6 }, (_, i) => ({
        id: `record-${i}`,
        taxYear: 2025 - i,
        profile: {
          id: `profile-${i}`,
          taxYear: 2025 - i,
          incomeType: 'employee' as const,
          annualSalary: 50000000,
          freelanceIncome: 0,
          dependents: 0,
          updatedAt: baseTime + i,
        },
        deductions: {
          creditCard: 0,
          medical: 0,
          education: 0,
          irp: 0,
          insurance: 0,
          donation: 0,
        },
        result: {
          taxableIncome: 50000000,
          calculatedTax: 8000000,
          prepaidTax: 7000000,
          refundAmount: 1000000,
          breakdown: [],
          needsGlobalFiling: false,
          computedAt: baseTime + i,
        },
        savedAt: baseTime + i, // Incrementing timestamps
      }));

      // Save 6 records sequentially
      for (const record of records) {
        const result = saveRecord(record);
        expect(result).toBe(true);
      }

      // Verify only 5 remain, with oldest (record-0, savedAt=1000000) removed
      const stored = getRecords();
      expect(stored).toHaveLength(5);
      expect(stored.map(r => r.id)).toEqual(['record-1', 'record-2', 'record-3', 'record-4', 'record-5']);
      expect(stored[0].savedAt).toBe(baseTime + 1);
      expect(stored[4].savedAt).toBe(baseTime + 5);
    });

    it('AC-3.2: should return false and not crash on QuotaExceededError', async () => {
      const { saveRecord } = await import('@/lib/storage');

      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      });

      const record: SavedRecord = {
        id: 'record-quota',
        taxYear: 2025,
        profile: {
          id: 'profile-quota',
          taxYear: 2025,
          incomeType: 'employee',
          annualSalary: 50000000,
          freelanceIncome: 0,
          dependents: 0,
          updatedAt: Date.now(),
        },
        deductions: {
          creditCard: 0,
          medical: 0,
          education: 0,
          irp: 0,
          insurance: 0,
          donation: 0,
        },
        result: {
          taxableIncome: 50000000,
          calculatedTax: 8000000,
          prepaidTax: 7000000,
          refundAmount: 1000000,
          breakdown: [],
          needsGlobalFiling: false,
          computedAt: Date.now(),
        },
        savedAt: Date.now(),
      };

      const result = saveRecord(record);
      expect(result).toBe(false);

      // Restore original setItem
      localStorage.setItem = originalSetItem;
    });

    it('AC-3.3: should allow saving up to 5 records without removal', async () => {
      const { saveRecord, getRecords } = await import('@/lib/storage');

      const baseTime = 2000000;
      for (let i = 0; i < 5; i++) {
        const record: SavedRecord = {
          id: `record-${i}`,
          taxYear: 2025 - i,
          profile: {
            id: `profile-${i}`,
            taxYear: 2025 - i,
            incomeType: 'employee',
            annualSalary: 50000000,
            freelanceIncome: 0,
            dependents: 0,
            updatedAt: baseTime + i,
          },
          deductions: {
            creditCard: 0,
            medical: 0,
            education: 0,
            irp: 0,
            insurance: 0,
            donation: 0,
          },
          result: {
            taxableIncome: 50000000,
            calculatedTax: 8000000,
            prepaidTax: 7000000,
            refundAmount: 1000000,
            breakdown: [],
            needsGlobalFiling: false,
            computedAt: baseTime + i,
          },
          savedAt: baseTime + i,
        };

        const result = saveRecord(record);
        expect(result).toBe(true);
      }

      const stored = getRecords();
      expect(stored).toHaveLength(5);
      expect(stored.map(r => r.id)).toEqual(['record-0', 'record-1', 'record-2', 'record-3', 'record-4']);
    });
  });

  // ============================================================================
  // AC-4: 손상 JSON 및 키 부재 처리 — 예외 없이 기본값 반환,
  //       console.error 미출력; getRecords는 []
  // ============================================================================
  describe('AC-4: Corrupted JSON and missing key fallback', () => {
    it('AC-4.1: should return default profile when key is missing', async () => {
      const { getProfile } = await import('@/lib/storage');

      // No localStorage entry for taxback:profile
      const result = getProfile();
      expect(result).not.toBeNull();
      expect(result?.annualSalary).toBe(0);
      expect(result?.dependents).toBe(0);
      expect(result?.taxYear).toBe(new Date().getFullYear());
    });

    it('AC-4.2: should return default profile when JSON is corrupted', async () => {
      const { getProfile } = await import('@/lib/storage');

      // Set corrupted JSON
      localStorage.setItem('taxback:profile', '{invalid json');

      // Mock console.error to verify it's not called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getProfile();
      expect(result).not.toBeNull();
      expect(result?.annualSalary).toBe(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('AC-4.3: should return empty array when records key is missing', async () => {
      const { getRecords } = await import('@/lib/storage');

      // No localStorage entry for taxback:records
      const result = getRecords();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('AC-4.4: should return empty array when records JSON is corrupted', async () => {
      const { getRecords } = await import('@/lib/storage');

      // Set corrupted JSON
      localStorage.setItem('taxback:records', '[{invalid}]');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getRecords();
      expect(result).toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('AC-4.5: should return default deductions when key is missing', async () => {
      const { getDeductions } = await import('@/lib/storage');

      const result = getDeductions();
      expect(result).not.toBeNull();
      expect(result?.creditCard).toBe(0);
      expect(result?.medical).toBe(0);
      expect(result?.education).toBe(0);
      expect(result?.irp).toBe(0);
      expect(result?.insurance).toBe(0);
      expect(result?.donation).toBe(0);
    });

    it('AC-4.6: should return default checklist when key is missing', async () => {
      const { getChecklist } = await import('@/lib/storage');

      const result = getChecklist();
      expect(result).not.toBeNull();
      expect(result?.totalCount).toBe(6);
      expect(result?.achievedCount).toBe(0);
      expect(result?.items).toHaveLength(6);
    });

    it('AC-4.7: should return default meta when key is missing', async () => {
      const { getMeta } = await import('@/lib/storage');

      const result = getMeta();
      expect(result).not.toBeNull();
      expect(result?.disclaimerAcknowledged).toBe(false);
      expect(result?.lastVisitAt).toBe(0);
      expect(result?.seasonBannerDismissedYear).toBeNull();
    });
  });

  // ============================================================================
  // AC-1 (Continued): Basic CRUD functionality per entity
  // ============================================================================
  describe('AC-1 (Extended): Basic CRUD for all entities', () => {
    it('AC-1.E1: should save and retrieve Deductions', async () => {
      const { saveDeductions, getDeductions } = await import('@/lib/storage');
      const deductions: Deductions = {
        creditCard: 3000000,
        medical: 1000000,
        education: 2000000,
        irp: 9000000,
        insurance: 1500000,
        donation: 500000,
      };

      const saveResult = saveDeductions(deductions);
      expect(saveResult).toBe(true);

      const retrieved = getDeductions();
      expect(retrieved?.creditCard).toBe(3000000);
      expect(retrieved?.irp).toBe(9000000);
    });

    it('AC-1.E2: should save and retrieve ChecklistState', async () => {
      const { saveChecklist, getChecklist } = await import('@/lib/storage');
      const checklist: ChecklistState = {
        items: [
          {
            key: 'irp',
            label: 'IRP 연 900만원 납입',
            targetAmount: 9000000,
            currentAmount: 9000000,
            done: true,
          },
          {
            key: 'pension',
            label: '퇴직연금 납입',
            targetAmount: 5000000,
            currentAmount: 0,
            done: false,
          },
          {
            key: 'medical',
            label: '의료비 공제',
            targetAmount: 3000000,
            currentAmount: 1000000,
            done: false,
          },
          {
            key: 'creditCard',
            label: '신용카드 사용액',
            targetAmount: 3000000,
            currentAmount: 2000000,
            done: false,
          },
          {
            key: 'donation',
            label: '기부금 공제',
            targetAmount: 500000,
            currentAmount: 0,
            done: false,
          },
          {
            key: 'housing',
            label: '주택관련 공제',
            targetAmount: 4000000,
            currentAmount: 0,
            done: false,
          },
        ],
        achievedCount: 1,
        totalCount: 6,
        updatedAt: Date.now(),
      };

      const saveResult = saveChecklist(checklist);
      expect(saveResult).toBe(true);

      const retrieved = getChecklist();
      expect(retrieved?.totalCount).toBe(6);
      expect(retrieved?.achievedCount).toBe(1);
      expect(retrieved?.items[0].done).toBe(true);
    });

    it('AC-1.E3: should save and retrieve AppMeta', async () => {
      const { saveMeta, getMeta } = await import('@/lib/storage');
      const meta: AppMeta = {
        disclaimerAcknowledged: true,
        lastVisitAt: Date.now(),
        seasonBannerDismissedYear: 2025,
      };

      const saveResult = saveMeta(meta);
      expect(saveResult).toBe(true);

      const retrieved = getMeta();
      expect(retrieved?.disclaimerAcknowledged).toBe(true);
      expect(retrieved?.seasonBannerDismissedYear).toBe(2025);
    });
  });
});
