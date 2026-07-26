/**
 * Packet 0005: useTaxData hook
 *
 * 소득·계산 결과 상태 관리
 * - profile: TaxProfile (사용자 입력)
 * - deductions: Deductions (공제 항목)
 * - result: TaxResult | null (계산 결과, 계산 전까지 null)
 * - updateProfile: (profile: TaxProfile) => void
 * - updateDeductions: (deductions: Deductions) => void
 *
 * Storage: localStorage 경유, 초기화 시 저장값 부재하면 안전 기본값 반환
 */

import { useState, useCallback, useMemo } from 'react';
import type { TaxProfile, Deductions, TaxResult } from '@/lib/types';
import { getProfile, saveProfile, getDeductions, saveDeductions } from '@/lib/storage';
import { calcTax } from '@/lib/calc';

export interface UseTaxDataReturn {
  profile: TaxProfile;
  deductions: Deductions;
  result: TaxResult | null;
  updateProfile: (profile: TaxProfile) => void;
  updateDeductions: (deductions: Deductions) => void;
}

/**
 * 소득·공제·결과 상태 관리 훅
 * 초기화 시 localStorage에서 로드, 없으면 기본값 사용
 */
export function useTaxData(): UseTaxDataReturn {
  const [profile, setProfile] = useState<TaxProfile>(getProfile() || {
    id: '',
    taxYear: new Date().getFullYear(),
    incomeType: 'employee',
    annualSalary: 0,
    freelanceIncome: 0,
    dependents: 0,
    updatedAt: 0,
  });

  const [deductions, setDeductions] = useState<Deductions>(getDeductions() || {
    creditCard: 0,
    medical: 0,
    education: 0,
    irp: 0,
    insurance: 0,
    donation: 0,
  });

  const updateProfile = useCallback((updated: TaxProfile) => {
    saveProfile(updated);
    setProfile(updated);
  }, []);

  const updateDeductions = useCallback((updated: Deductions) => {
    saveDeductions(updated);
    setDeductions(updated);
  }, []);

  // profile.id가 없으면 아직 소득 입력을 제출하지 않은 상태 — 계산 결과 없음
  const result = useMemo<TaxResult | null>(
    () => (profile.id ? calcTax(profile, deductions) : null),
    [profile, deductions]
  );

  return {
    profile,
    deductions,
    result,
    updateProfile,
    updateDeductions,
  };
}
