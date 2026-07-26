/**
 * Packet 0006: useChecklistData hook
 *
 * 절세 체크리스트·기록 상태 관리
 * - checklist: ChecklistState (6항목, 진행률)
 * - records: SavedRecord[] (연도별 저장 스냅샷, 최대 5개)
 * - updateChecklist: (checklist: ChecklistState) => void
 * - saveRecord: (record: SavedRecord) => void
 *
 * Storage: localStorage 경유, 초기화 시 저장값 부재하면 안전 기본값 반환
 */

import { useState, useCallback } from 'react';
import type { ChecklistState, SavedRecord } from '@/lib/types';
import { getChecklist, saveChecklist, getRecords, saveRecord } from '@/lib/storage';
import { CHECKLIST_DEFAULTS } from '@/lib/constants';

export interface UseChecklistDataReturn {
  checklist: ChecklistState;
  records: SavedRecord[];
  updateChecklist: (checklist: ChecklistState) => void;
  saveRecord: (record: SavedRecord) => boolean;
}

/**
 * 절세 체크리스트·기록 상태 관리 훅
 * 초기화 시 localStorage에서 로드, 없으면 기본값 사용
 */
export function useChecklistData(): UseChecklistDataReturn {
  const [checklist, setChecklist] = useState<ChecklistState>(getChecklist() || {
    items: CHECKLIST_DEFAULTS,
    achievedCount: 0,
    totalCount: 6,
    updatedAt: 0,
  });

  const [records, setRecords] = useState<SavedRecord[]>(getRecords() || []);

  const updateChecklist = useCallback((updated: ChecklistState) => {
    saveChecklist(updated);
    setChecklist(updated);
  }, []);

  const recordSave = useCallback((record: SavedRecord): boolean => {
    const ok = saveRecord(record);
    if (ok) setRecords(getRecords());
    return ok;
  }, []);

  return {
    checklist,
    records,
    updateChecklist,
    saveRecord: recordSave,
  };
}
