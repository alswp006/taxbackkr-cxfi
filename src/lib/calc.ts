/**
 * TaxBackKR 계산 엔진 (Packet 0003)
 *
 * TaxProfile + Deductions → TaxResult 산출 순수 함수와 종합소득세 신고 대상 판정 함수.
 * SPEC: .ai-factory/spec.md F3, F6
 */

import type { Deductions, DeductionBreakdownItem, TaxProfile, TaxResult } from '@/lib/types';
import { DEDUCTION_LIMITS, TAX_BRACKETS } from '@/lib/constants';

const GLOBAL_FILING_OTHER_INCOME_THRESHOLD = 3000000;

const DEDUCTION_LABELS: Record<keyof Deductions, string> = {
  creditCard: '신용카드 소득공제',
  medical: '의료비 세액공제',
  education: '교육비 세액공제',
  irp: 'IRP·연금저축 세액공제',
  insurance: '보험료 세액공제',
  donation: '기부금 세액공제',
};

/** NaN/Infinity를 0으로 보정 (console.error 없이 조용히 degrade) */
function safeNumber(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** 과세표준 구간·세율(누진공제)로 세액 산출, 음수 방지 후 정수 반올림 */
function computeTaxByBracket(income: number): number {
  const safeIncome = Math.max(0, safeNumber(income));
  const bracket =
    TAX_BRACKETS.find((b) => safeIncome >= b.from && (b.to === null || safeIncome < b.to)) ??
    TAX_BRACKETS[TAX_BRACKETS.length - 1];
  const raw = safeIncome * bracket.rate - bracket.progressiveDeduction;
  return Math.round(safeNumber(Math.max(0, raw)));
}

function buildBreakdown(deductions: Deductions): DeductionBreakdownItem[] {
  return (Object.keys(DEDUCTION_LIMITS) as (keyof Deductions)[]).map((key) => {
    const limit = safeNumber(DEDUCTION_LIMITS[key]);
    const rawAmount = Math.max(0, safeNumber(deductions[key]));
    const appliedAmount = Math.min(rawAmount, limit);
    const usedRatio = limit > 0 ? clamp(safeNumber(appliedAmount / limit), 0, 1) : 0;

    return {
      key,
      label: DEDUCTION_LABELS[key],
      appliedAmount,
      limit,
      usedRatio,
    };
  });
}

/**
 * TaxProfile + Deductions → TaxResult
 * taxableIncome = annualSalary - 적용 공제 합계 (0 이상, annualSalary 이하로 클램프)
 * prepaidTax는 공제 미적용 상태(근로소득 총급여 기준) 원천징수 추정치로 근사한다.
 */
export function calcTax(profile: TaxProfile, deductions: Deductions): TaxResult {
  const annualSalary = Math.max(0, safeNumber(profile.annualSalary));
  const breakdown = buildBreakdown(deductions);
  const totalDeduction = breakdown.reduce((sum, item) => sum + item.appliedAmount, 0);

  const taxableIncome = clamp(safeNumber(annualSalary - totalDeduction), 0, annualSalary);
  const calculatedTax = computeTaxByBracket(taxableIncome);
  const prepaidTax = computeTaxByBracket(annualSalary);
  const refundAmount = Math.round(safeNumber(prepaidTax - calculatedTax));

  return {
    taxableIncome,
    calculatedTax,
    prepaidTax,
    refundAmount,
    breakdown,
    needsGlobalFiling: checkGlobalFiling(profile),
    computedAt: Date.now(),
  };
}

/**
 * 종합소득세 신고 대상 판정
 * - freelancer: 사업소득이 있는 형식이므로 항상 신고 대상
 * - multi: 기타(부업)소득이 300만원 초과일 때만 신고 대상
 * - employee: 근로소득 단일소득은 연말정산으로 종결(비대상)
 */
export function checkGlobalFiling(profile: TaxProfile): boolean {
  if (profile.incomeType === 'freelancer') return true;
  if (profile.incomeType === 'multi') {
    return safeNumber(profile.freelanceIncome) > GLOBAL_FILING_OTHER_INCOME_THRESHOLD;
  }
  return false;
}

/** 종합소득세 신고 대상 판정 근거 문구 */
export function getGlobalFilingReason(profile: TaxProfile): string {
  if (profile.incomeType === 'freelancer') {
    return '사업소득이 있는 프리랜서는 종합소득세 신고 대상이에요';
  }
  if (profile.incomeType === 'multi') {
    return safeNumber(profile.freelanceIncome) > GLOBAL_FILING_OTHER_INCOME_THRESHOLD
      ? '기타소득이 연 300만원을 초과해 신고 대상이에요'
      : '기타소득이 연 300만원 이하로 연말정산으로 종결돼요';
  }
  return '근로소득 단일소득으로 연말정산으로 종결돼요';
}
