/**
 * Packet 0005/0006: TaxDataProvider
 *
 * App.tsx 최상위에서 제공하는 데이터 컨텍스트
 * - useTaxData(profile/deductions/result) 훅에서 상태를 가져옴
 * - useChecklistData(checklist/records) 훅에서 상태를 가져옴
 * - 모든 페이지(6개)가 useTaxContext 훅으로 데이터 소비
 *
 * React.createContext + Provider 패턴
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { TaxProfile, Deductions, TaxResult, ChecklistState, SavedRecord } from '@/lib/types';
import { useTaxData } from '@/hooks/useTaxData';
import { useChecklistData } from '@/hooks/useChecklistData';

export interface TaxContextValue {
  // 소득·공제·결과
  profile: TaxProfile;
  deductions: Deductions;
  result: TaxResult | null;
  updateProfile: (profile: TaxProfile) => void;
  updateDeductions: (deductions: Deductions) => void;

  // 체크리스트·기록
  checklist: ChecklistState;
  records: SavedRecord[];
  updateChecklist: (checklist: ChecklistState) => void;
  saveRecord: (record: SavedRecord) => boolean;
}

const TaxContext = createContext<TaxContextValue | undefined>(undefined);

export interface TaxDataProviderProps {
  children: ReactNode;
}

/**
 * TaxDataProvider — 앱 최상위 Provider
 * 모든 페이지에 데이터 공급
 */
export function TaxDataProvider({ children }: TaxDataProviderProps) {
  const taxData = useTaxData();
  const checklistData = useChecklistData();

  const value: TaxContextValue = {
    // 소득·공제·결과
    profile: taxData.profile,
    deductions: taxData.deductions,
    result: taxData.result,
    updateProfile: taxData.updateProfile,
    updateDeductions: taxData.updateDeductions,

    // 체크리스트·기록
    checklist: checklistData.checklist,
    records: checklistData.records,
    updateChecklist: checklistData.updateChecklist,
    saveRecord: checklistData.saveRecord,
  };

  return <TaxContext.Provider value={value}>{children}</TaxContext.Provider>;
}

/**
 * useTaxContext — 페이지에서 데이터 소비하는 훅
 */
export function useTaxContext(): TaxContextValue {
  const context = useContext(TaxContext);
  if (!context) {
    throw new Error('useTaxContext must be used within TaxDataProvider');
  }
  return context;
}
