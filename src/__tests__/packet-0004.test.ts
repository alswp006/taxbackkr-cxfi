/**
 * TDD Test: Packet 0004 — 체크리스트 파생 로직 (deriveChecklist)
 * SPEC: .ai-factory/spec.md F7 (절세 체크리스트 & 달성도)
 *
 * Acceptance Criteria:
 * AC-1: deriveChecklist(deductions, storedChecklist?) returns ChecklistState with 6 items, totalCount === 6
 * AC-2: currentAmount >= targetAmount → done: true, achievedCount reflects count of done items
 * AC-3: Recalculate achievedCount from actual done items, not stored value (저장값 신뢰하지 않음)
 */

import { describe, it, expect } from 'vitest';
import type { Deductions, ChecklistState } from '@/lib/types';
import { CHECKLIST_DEFAULTS, DEDUCTION_LIMITS } from '@/lib/constants';

/**
 * Mock function signature — actual implementation will be in src/lib/checklist.ts
 * function deriveChecklist(deductions: Deductions, storedChecklist?: ChecklistState): ChecklistState
 */
function deriveChecklist(deductions: Deductions, storedChecklist?: ChecklistState): ChecklistState {
  // This is a placeholder — the actual implementation will be provided by the Coder
  // For test-first, we just expect the function to exist and have this signature
  throw new Error('deriveChecklist not yet implemented');
}

describe('deriveChecklist — 체크리스트 파생 로직', () => {
  // ============================================================================
  // AC-1: Always return 6 items with totalCount === 6
  // ============================================================================

  it('AC-1a: should always return exactly 6 items', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    expect(result.items).toHaveLength(6);
  });

  it('AC-1b: should set totalCount === 6', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    expect(result.totalCount).toBe(6);
  });

  it('AC-1c: should return all 6 expected checklist keys', () => {
    const deductions: Deductions = {
      creditCard: 1000000,
      medical: 2000000,
      education: 3000000,
      irp: 4000000,
      insurance: 500000,
      donation: 1500000,
    };

    const result = deriveChecklist(deductions);

    const keys = result.items.map(item => item.key).sort();
    const expectedKeys = ['irp', 'pension', 'medical', 'creditCard', 'donation', 'housing'].sort();

    expect(keys).toEqual(expectedKeys);
  });

  it('AC-1d: each item should have complete structure (key, label, targetAmount, currentAmount, done)', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    result.items.forEach(item => {
      expect(item).toHaveProperty('key');
      expect(item).toHaveProperty('label');
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(item).toHaveProperty('targetAmount');
      expect(typeof item.targetAmount).toBe('number');
      expect(item.targetAmount).toBeGreaterThan(0);
      expect(item).toHaveProperty('currentAmount');
      expect(typeof item.currentAmount).toBe('number');
      expect(item.currentAmount).toBeGreaterThanOrEqual(0);
      expect(item).toHaveProperty('done');
      expect(typeof item.done).toBe('boolean');
    });
  });

  // ============================================================================
  // AC-2: currentAmount >= targetAmount → done: true, achievedCount reflects count
  // ============================================================================

  it('AC-2a: should set done:true when currentAmount >= targetAmount (IRP example)', () => {
    // IRP targetAmount is 9,000,000
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 9000000, // exactly at target
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    const irpItem = result.items.find(item => item.key === 'irp');
    expect(irpItem).toBeDefined();
    expect(irpItem?.currentAmount).toBe(9000000);
    expect(irpItem?.done).toBe(true);
  });

  it('AC-2b: should set done:true when currentAmount > targetAmount', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 10000000, // above target (9M)
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    const irpItem = result.items.find(item => item.key === 'irp');
    expect(irpItem?.done).toBe(true);
  });

  it('AC-2c: should set done:false when currentAmount < targetAmount', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 5000000, // below target (9M)
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    const irpItem = result.items.find(item => item.key === 'irp');
    expect(irpItem?.done).toBe(false);
  });

  it('AC-2d: achievedCount should equal count of done items (multiple items)', () => {
    const deductions: Deductions = {
      creditCard: 3000000, // creditCard target: 3M → done
      medical: 7000000,    // medical target: 7M → done
      education: 0,        // not mapped or always 0
      irp: 0,              // irp target: 9M → not done
      insurance: 0,        // pension target: 3M → not done
      donation: 0,         // donation target: 1M → not done
    };

    const result = deriveChecklist(deductions);

    // At least creditCard and medical should be done
    const doneCount = result.items.filter(item => item.done).length;
    expect(result.achievedCount).toBe(doneCount);
    expect(result.achievedCount).toBeGreaterThanOrEqual(2);
  });

  it('AC-2e: achievedCount should be 0 when no items meet targetAmount', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    expect(result.achievedCount).toBe(0);
  });

  it('AC-2f: achievedCount should be 6 when all items are done', () => {
    const deductions: Deductions = {
      creditCard: 3000000,  // ≥ 3M target
      medical: 7000000,     // ≥ 7M target
      education: 9000000,   // ≥ 9M target (or not mapped)
      irp: 9000000,         // ≥ 9M target
      insurance: 3000000,   // ≥ 3M target (pension)
      donation: 1000000,    // ≥ 1M target
    };

    const result = deriveChecklist(deductions);

    expect(result.achievedCount).toBe(6);
  });

  // ============================================================================
  // AC-3: Recalculate achievedCount from actual done items (저장값을 신뢰하지 않음)
  // ============================================================================

  it('AC-3a: should recalculate achievedCount, ignoring stored incorrect value', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 9000000, // Only irp is done → achievedCount should be 1
      insurance: 0,
      donation: 0,
    };

    const storedChecklist: ChecklistState = {
      items: [],
      achievedCount: 5, // Incorrect stored value
      totalCount: 6,
      updatedAt: Date.now() - 1000,
    };

    const result = deriveChecklist(deductions, storedChecklist);

    // Should recalculate to 1 (only irp is done)
    expect(result.achievedCount).toBe(1);
  });

  it('AC-3b: should recalculate when stored value underestimates', () => {
    const deductions: Deductions = {
      creditCard: 3000000,  // done
      medical: 7000000,     // done
      education: 0,
      irp: 9000000,         // done
      insurance: 0,
      donation: 0,
    };

    const storedChecklist: ChecklistState = {
      items: [],
      achievedCount: 1, // Underestimated
      totalCount: 6,
      updatedAt: Date.now() - 1000,
    };

    const result = deriveChecklist(deductions, storedChecklist);

    // Should recalculate to at least 3
    expect(result.achievedCount).toBeGreaterThanOrEqual(3);
  });

  it('AC-3c: should recalculate when stored value overestimates', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };

    const storedChecklist: ChecklistState = {
      items: [],
      achievedCount: 6, // Overestimated
      totalCount: 6,
      updatedAt: Date.now() - 1000,
    };

    const result = deriveChecklist(deductions, storedChecklist);

    // Should recalculate to 0
    expect(result.achievedCount).toBe(0);
  });

  it('AC-3d: should calculate achievedCount correctly even if storedChecklist is undefined', () => {
    const deductions: Deductions = {
      creditCard: 3000000,
      medical: 0,
      education: 0,
      irp: 9000000,
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions, undefined);

    // Should work without storedChecklist parameter
    expect(result.achievedCount).toBeGreaterThanOrEqual(2);
  });

  // ============================================================================
  // Edge Cases & Robustness
  // ============================================================================

  it('should set updatedAt to current timestamp', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };

    const before = Date.now();
    const result = deriveChecklist(deductions);
    const after = Date.now();

    expect(result.updatedAt).toBeGreaterThanOrEqual(before);
    expect(result.updatedAt).toBeLessThanOrEqual(after);
  });

  it('should handle large deduction amounts (up to 100M)', () => {
    const deductions: Deductions = {
      creditCard: 100000000,
      medical: 100000000,
      education: 100000000,
      irp: 100000000,
      insurance: 100000000,
      donation: 100000000,
    };

    const result = deriveChecklist(deductions);

    expect(result.items).toHaveLength(6);
    expect(result.achievedCount).toBe(6);
    expect(result.totalCount).toBe(6);
  });

  it('should preserve targetAmount from defaults (not mutate)', () => {
    const deductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };

    const result = deriveChecklist(deductions);

    // Verify targetAmounts match expected limits
    const irpItem = result.items.find(item => item.key === 'irp');
    expect(irpItem?.targetAmount).toBe(CHECKLIST_DEFAULTS.find(d => d.key === 'irp')?.targetAmount);

    const ccItem = result.items.find(item => item.key === 'creditCard');
    expect(ccItem?.targetAmount).toBe(CHECKLIST_DEFAULTS.find(d => d.key === 'creditCard')?.targetAmount);
  });

  it('should be a pure function (same input → same output)', () => {
    const deductions: Deductions = {
      creditCard: 1500000,
      medical: 3500000,
      education: 2000000,
      irp: 5000000,
      insurance: 500000,
      donation: 800000,
    };

    const result1 = deriveChecklist(deductions);
    const result2 = deriveChecklist(deductions);

    expect(result1.items).toEqual(result2.items);
    expect(result1.achievedCount).toBe(result2.achievedCount);
    expect(result1.totalCount).toBe(result2.totalCount);
  });
});
