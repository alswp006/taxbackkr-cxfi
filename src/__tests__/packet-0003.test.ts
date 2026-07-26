/**
 * Packet 0003: 계산 엔진 (calcTax + checkGlobalFiling) 테스트
 *
 * TDD Red Phase — 모든 테스트는 실패 (구현 미존재)
 *
 * calcTax: TaxProfile + Deductions → TaxResult (과세표준·산출세액·환급액·6항목 breakdown)
 * checkGlobalFiling: TaxProfile → boolean (종합소득세 신고 대상 판정)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  TaxProfile,
  Deductions,
  TaxResult,
  DeductionBreakdownItem,
} from '@/lib/types';

// TODO: Coder가 작성할 함수들
// import {
//   calcTax,
//   checkGlobalFiling,
// } from '@/lib/calc';

describe('Packet-0003: 계산 엔진 (calcTax + checkGlobalFiling)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // AC-1: calcTax(profile, deductions) → TaxResult
  //       - refundAmount는 정수(원)
  //       - taxableIncome <= annualSalary 성립
  //       - 6항목 breakdown(각 usedRatio 0~1) 생성
  // ============================================================================
  describe('AC-1: calcTax returns valid TaxResult with integer refundAmount and constraints', () => {
    it('AC-1.1: should calculate tax for single-income employee with basic deductions', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-001',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 50000000, // 5,000만원
        freelanceIncome: 0,
        dependents: 1,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 3000000, // 300만원
        medical: 0,
        education: 0,
        irp: 9000000, // 900만원
        insurance: 1500000, // 150만원
        donation: 0,
      };

      const result: TaxResult = calcTax(profile, deductions);

      // TaxResult의 모든 필드 검증
      expect(result).toBeDefined();
      expect(typeof result.taxableIncome).toBe('number');
      expect(typeof result.calculatedTax).toBe('number');
      expect(typeof result.prepaidTax).toBe('number');
      expect(typeof result.refundAmount).toBe('number');
      expect(Array.isArray(result.breakdown)).toBe(true);
      expect(typeof result.needsGlobalFiling).toBe('boolean');
      expect(typeof result.computedAt).toBe('number');
    });

    it('AC-1.2: refundAmount must be an integer', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-002',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 52000000,
        freelanceIncome: 0,
        dependents: 0,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 2000000,
        medical: 500000,
        education: 1000000,
        irp: 5000000,
        insurance: 1000000,
        donation: 0,
      };

      const result = calcTax(profile, deductions);

      // refundAmount는 정수여야 함
      expect(Number.isInteger(result.refundAmount)).toBe(true);
      expect(result.refundAmount).toBe(Math.floor(result.refundAmount));
    });

    it('AC-1.3: taxableIncome must be <= annualSalary', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-003',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 60000000,
        freelanceIncome: 0,
        dependents: 2,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 4000000,
        medical: 2000000,
        education: 1500000,
        irp: 9000000,
        insurance: 2000000,
        donation: 500000,
      };

      const result = calcTax(profile, deductions);

      // 과세표준은 근로소득 이하여야 함
      expect(result.taxableIncome).toBeLessThanOrEqual(profile.annualSalary);
      expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
    });

    it('AC-1.4: breakdown should have 6 items, each with usedRatio in [0, 1]', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-004',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 70000000,
        freelanceIncome: 0,
        dependents: 3,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 5000000,
        medical: 3000000,
        education: 2000000,
        irp: 9000000,
        insurance: 2000000,
        donation: 1000000,
      };

      const result = calcTax(profile, deductions);

      // breakdown은 정확히 6개 항목
      expect(result.breakdown).toHaveLength(6);

      // 각 항목의 구조 검증
      result.breakdown.forEach((item: DeductionBreakdownItem) => {
        expect(typeof item.key).toBe('string');
        expect(typeof item.label).toBe('string');
        expect(typeof item.appliedAmount).toBe('number');
        expect(typeof item.limit).toBe('number');
        expect(typeof item.usedRatio).toBe('number');

        // usedRatio는 0과 1 사이여야 함
        expect(item.usedRatio).toBeGreaterThanOrEqual(0);
        expect(item.usedRatio).toBeLessThanOrEqual(1);

        // appliedAmount는 limit 이하
        expect(item.appliedAmount).toBeLessThanOrEqual(item.limit);
      });
    });

    it('AC-1.5: breakdown keys should correspond to Deductions fields', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-005',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 45000000,
        freelanceIncome: 0,
        dependents: 1,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 2000000,
        medical: 1000000,
        education: 1500000,
        irp: 8000000,
        insurance: 1000000,
        donation: 500000,
      };

      const result = calcTax(profile, deductions);

      // breakdown 항목들의 key 검증
      const keys = result.breakdown.map((item: DeductionBreakdownItem) => item.key);
      expect(keys).toContain('creditCard');
      expect(keys).toContain('medical');
      expect(keys).toContain('education');
      expect(keys).toContain('irp');
      expect(keys).toContain('insurance');
      expect(keys).toContain('donation');
    });

    it('AC-1.6: calculatedTax must be >= 0', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-006',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 30000000,
        freelanceIncome: 0,
        dependents: 0,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 0,
        medical: 0,
        education: 0,
        irp: 0,
        insurance: 0,
        donation: 0,
      };

      const result = calcTax(profile, deductions);

      // 산출세액은 음수가 될 수 없음
      expect(result.calculatedTax).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.calculatedTax)).toBe(true);
    });

    it('AC-1.7: prepaidTax must be >= 0', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-007',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 55000000,
        freelanceIncome: 0,
        dependents: 1,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 2500000,
        medical: 0,
        education: 0,
        irp: 7000000,
        insurance: 0,
        donation: 0,
      };

      const result = calcTax(profile, deductions);

      // 기납부세액은 음수가 될 수 없음
      expect(result.prepaidTax).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.prepaidTax)).toBe(true);
    });
  });

  // ============================================================================
  // AC-2: 내부 NaN 감지 시 해당 값 0 보정·console.error 미출력
  // ============================================================================
  describe('AC-2: NaN defense — invalid calculations result in 0, no console.error', () => {
    it('AC-2.1: should return 0 for computed NaN fields, never log console.error', () => {
      const { calcTax } = require('@/lib/calc');

      // Edge case: 0 salary with complex deductions
      const profile: TaxProfile = {
        id: 'profile-nan-001',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 0,
        freelanceIncome: 0,
        dependents: 0,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 0,
        medical: 0,
        education: 0,
        irp: 0,
        insurance: 0,
        donation: 0,
      };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = calcTax(profile, deductions);

      // 결과는 NaN이 아닌 유효한 수
      expect(Number.isNaN(result.taxableIncome)).toBe(false);
      expect(Number.isNaN(result.calculatedTax)).toBe(false);
      expect(Number.isNaN(result.refundAmount)).toBe(false);

      // 계산 결과는 유효한 숫자
      expect(typeof result.taxableIncome).toBe('number');
      expect(typeof result.calculatedTax).toBe('number');
      expect(typeof result.refundAmount).toBe('number');

      // console.error는 호출되지 않음
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('AC-2.2: breakdown items should never contain NaN usedRatio or appliedAmount', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-nan-002',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 100000000,
        freelanceIncome: 0,
        dependents: 10,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 100000000, // Very large
        medical: 100000000,
        education: 100000000,
        irp: 100000000,
        insurance: 100000000,
        donation: 100000000,
      };

      const result = calcTax(profile, deductions);

      result.breakdown.forEach((item: DeductionBreakdownItem) => {
        expect(Number.isNaN(item.usedRatio)).toBe(false);
        expect(Number.isNaN(item.appliedAmount)).toBe(false);
        expect(Number.isNaN(item.limit)).toBe(false);

        // 값들은 유효한 숫자
        expect(typeof item.appliedAmount).toBe('number');
        expect(typeof item.limit).toBe('number');
        expect(typeof item.usedRatio).toBe('number');
      });
    });

    it('AC-2.3: computedAt should always be a valid timestamp, not NaN', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-nan-003',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 50000000,
        freelanceIncome: 0,
        dependents: 1,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 0,
        medical: 0,
        education: 0,
        irp: 0,
        insurance: 0,
        donation: 0,
      };

      const result = calcTax(profile, deductions);

      // computedAt는 유효한 타임스탐프
      expect(Number.isNaN(result.computedAt)).toBe(false);
      expect(result.computedAt).toBeGreaterThan(0);
      expect(Number.isInteger(result.computedAt)).toBe(true);
    });
  });

  // ============================================================================
  // AC-3: checkGlobalFiling(profile) → boolean
  //       - freelancer(freelanceIncome>0) → true
  //       - employee 단일소득 → false
  //       - multi & 기타소득 300만원 초과 → true
  //       - TaxResult.needsGlobalFiling 반영
  // ============================================================================
  describe('AC-3: checkGlobalFiling returns correct boolean for filing requirement', () => {
    it('AC-3.1: freelancer with freelanceIncome > 0 should require global filing', () => {
      const { checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-gf-001',
        taxYear: 2025,
        incomeType: 'freelancer',
        annualSalary: 0,
        freelanceIncome: 10000000, // 1,000만원
        dependents: 0,
        updatedAt: Date.now(),
      };

      const result = checkGlobalFiling(profile);

      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });

    it('AC-3.2: single-income employee should NOT require global filing', () => {
      const { checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-gf-002',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 50000000, // 단일소득
        freelanceIncome: 0,
        dependents: 1,
        updatedAt: Date.now(),
      };

      const result = checkGlobalFiling(profile);

      expect(result).toBe(false);
      expect(typeof result).toBe('boolean');
    });

    it('AC-3.3: multi-income with freelanceIncome > 3,000,000 should require global filing', () => {
      const { checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-gf-003',
        taxYear: 2025,
        incomeType: 'multi',
        annualSalary: 40000000,
        freelanceIncome: 5000000, // 500만원 > 300만원
        dependents: 0,
        updatedAt: Date.now(),
      };

      const result = checkGlobalFiling(profile);

      expect(result).toBe(true);
    });

    it('AC-3.4: multi-income with freelanceIncome <= 3,000,000 should NOT require global filing', () => {
      const { checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-gf-004',
        taxYear: 2025,
        incomeType: 'multi',
        annualSalary: 50000000,
        freelanceIncome: 2000000, // 200만원 <= 300만원
        dependents: 1,
        updatedAt: Date.now(),
      };

      const result = checkGlobalFiling(profile);

      expect(result).toBe(false);
    });

    it('AC-3.5: multi-income with freelanceIncome exactly 3,000,000 should NOT require global filing', () => {
      const { checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-gf-005',
        taxYear: 2025,
        incomeType: 'multi',
        annualSalary: 50000000,
        freelanceIncome: 3000000, // 정확히 300만원 (경계값)
        dependents: 0,
        updatedAt: Date.now(),
      };

      const result = checkGlobalFiling(profile);

      expect(result).toBe(false);
    });

    it('AC-3.6: multi-income with freelanceIncome > 3,000,000 should require global filing (boundary)', () => {
      const { checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-gf-006',
        taxYear: 2025,
        incomeType: 'multi',
        annualSalary: 40000000,
        freelanceIncome: 3000001, // 300만원 + 1원 (경계값 초과)
        dependents: 2,
        updatedAt: Date.now(),
      };

      const result = checkGlobalFiling(profile);

      expect(result).toBe(true);
    });

    it('AC-3.7: freelancer with 0 freelanceIncome should still require global filing if incomeType is freelancer', () => {
      const { checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-gf-007',
        taxYear: 2025,
        incomeType: 'freelancer',
        annualSalary: 0,
        freelanceIncome: 0, // But type is freelancer
        dependents: 0,
        updatedAt: Date.now(),
      };

      const result = checkGlobalFiling(profile);

      // freelancer incomeType이면 신고 필수 (형식상)
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION: TaxResult.needsGlobalFiling matches checkGlobalFiling(profile)
  // ============================================================================
  describe('INTEGRATION: TaxResult.needsGlobalFiling aligns with checkGlobalFiling', () => {
    it('should have consistent needsGlobalFiling between calcTax and checkGlobalFiling', () => {
      const { calcTax, checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-int-001',
        taxYear: 2025,
        incomeType: 'freelancer',
        annualSalary: 0,
        freelanceIncome: 15000000,
        dependents: 0,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 2000000,
        medical: 0,
        education: 0,
        irp: 5000000,
        insurance: 0,
        donation: 0,
      };

      const taxResult = calcTax(profile, deductions);
      const fileRequired = checkGlobalFiling(profile);

      // TaxResult.needsGlobalFiling should match checkGlobalFiling result
      expect(taxResult.needsGlobalFiling).toBe(fileRequired);
      expect(taxResult.needsGlobalFiling).toBe(true); // freelancer이므로 true
    });

    it('should have consistent needsGlobalFiling for employee with no other income', () => {
      const { calcTax, checkGlobalFiling } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-int-002',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 60000000,
        freelanceIncome: 0,
        dependents: 2,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 3000000,
        medical: 1000000,
        education: 1000000,
        irp: 7000000,
        insurance: 1500000,
        donation: 500000,
      };

      const taxResult = calcTax(profile, deductions);
      const fileRequired = checkGlobalFiling(profile);

      expect(taxResult.needsGlobalFiling).toBe(fileRequired);
      expect(taxResult.needsGlobalFiling).toBe(false); // employee + single income
    });
  });

  // ============================================================================
  // EDGE CASES & VALIDATION
  // ============================================================================
  describe('Edge cases and validation', () => {
    it('should handle zero salary and zero freelance income', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-edge-001',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 0,
        freelanceIncome: 0,
        dependents: 0,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 0,
        medical: 0,
        education: 0,
        irp: 0,
        insurance: 0,
        donation: 0,
      };

      const result = calcTax(profile, deductions);

      expect(result.taxableIncome).toBe(0);
      expect(result.calculatedTax).toBe(0);
      expect(result.refundAmount).toBeGreaterThanOrEqual(0);
    });

    it('should handle maximum valid salary (100M)', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-edge-002',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 100000000,
        freelanceIncome: 0,
        dependents: 3,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 5000000,
        medical: 3000000,
        education: 2000000,
        irp: 9000000,
        insurance: 2000000,
        donation: 1000000,
      };

      const result = calcTax(profile, deductions);

      expect(result.taxableIncome).toBeLessThanOrEqual(100000000);
      expect(result.calculatedTax).toBeGreaterThan(0);
      expect(Number.isNaN(result.calculatedTax)).toBe(false);
    });

    it('should handle deductions exceeding reasonable limits', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-edge-003',
        taxYear: 2025,
        incomeType: 'employee',
        annualSalary: 50000000,
        freelanceIncome: 0,
        dependents: 1,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 100000000, // Exceeds salary
        medical: 100000000,
        education: 100000000,
        irp: 100000000,
        insurance: 100000000,
        donation: 100000000,
      };

      const result = calcTax(profile, deductions);

      // Should handle gracefully — taxableIncome should not go below 0
      expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
      expect(result.taxableIncome).toBeLessThanOrEqual(50000000);
    });

    it('should always return breakdown with exactly 6 items', () => {
      const { calcTax } = require('@/lib/calc');

      const profile: TaxProfile = {
        id: 'profile-edge-004',
        taxYear: 2025,
        incomeType: 'multi',
        annualSalary: 30000000,
        freelanceIncome: 8000000,
        dependents: 0,
        updatedAt: Date.now(),
      };

      const deductions: Deductions = {
        creditCard: 500000,
        medical: 500000,
        education: 500000,
        irp: 2000000,
        insurance: 500000,
        donation: 200000,
      };

      const result = calcTax(profile, deductions);

      expect(result.breakdown).toHaveLength(6);
      expect(Array.isArray(result.breakdown)).toBe(true);
    });
  });
});
