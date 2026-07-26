/**
 * 절세 체크리스트 파생 로직 (Packet 0004)
 *
 * Deductions에서 ChecklistState를 순수 함수로 파생/재계산한다.
 * 저장된 achievedCount는 신뢰하지 않고 실제 done 항목 수로 재산출한다.
 * SPEC: .ai-factory/spec.md F7
 */

import type { ChecklistItem, ChecklistKey, ChecklistState, Deductions } from '@/lib/types';
import { CHECKLIST_DEFAULTS } from '@/lib/constants';

/** ChecklistKey → Deductions 키 매핑 (pension은 insurance, housing은 education에서 파생) */
const CHECKLIST_SOURCE: Record<ChecklistKey, keyof Deductions> = {
  irp: 'irp',
  pension: 'insurance',
  medical: 'medical',
  creditCard: 'creditCard',
  donation: 'donation',
  housing: 'education',
};

export function deriveChecklist(deductions: Deductions, storedChecklist?: ChecklistState): ChecklistState {
  const items: ChecklistItem[] = CHECKLIST_DEFAULTS.map((defaults) => {
    const currentAmount = deductions[CHECKLIST_SOURCE[defaults.key]];
    return {
      key: defaults.key,
      label: defaults.label,
      targetAmount: defaults.targetAmount,
      currentAmount,
      done: currentAmount >= defaults.targetAmount,
    };
  });

  return {
    items,
    achievedCount: items.filter((item) => item.done).length,
    totalCount: 6,
    updatedAt: Date.now(),
  };
}
