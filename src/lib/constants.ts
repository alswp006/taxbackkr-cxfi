/**
 * TaxBackKR Constants (Packet 0001)
 *
 * 2025 귀속연도 기준 과세표준 구간·세율, 공제 항목별 한도, 체크리스트 기본값,
 * 항목별 절세 팁 상수 테이블. 순수 데이터만 포함 — 런타임 로직 없음.
 * SPEC: .ai-factory/spec.md
 */

import type { Deductions, ChecklistItem } from '@/lib/types';

/**
 * 종합소득세 과세표준 구간 1개
 * @property from - 구간 하한, 원 (포함)
 * @property to - 구간 상한, 원 (미포함) — 최고 구간은 null(상한 없음)
 * @property rate - 세율 (0~1)
 * @property progressiveDeduction - 누진공제액, 원
 */
export interface TaxBracket {
  from: number;
  to: number | null;
  rate: number;
  progressiveDeduction: number;
}

/**
 * 2025 귀속연도 종합소득세 과세표준 구간·세율 (누진공제 방식)
 * 산출세액 = 과세표준 * rate - progressiveDeduction
 */
export const TAX_BRACKETS: TaxBracket[] = [
  { from: 0, to: 14000000, rate: 0.06, progressiveDeduction: 0 },
  { from: 14000000, to: 50000000, rate: 0.15, progressiveDeduction: 1260000 },
  { from: 50000000, to: 88000000, rate: 0.24, progressiveDeduction: 5760000 },
  { from: 88000000, to: 150000000, rate: 0.35, progressiveDeduction: 15440000 },
  { from: 150000000, to: 300000000, rate: 0.38, progressiveDeduction: 19940000 },
  { from: 300000000, to: 500000000, rate: 0.4, progressiveDeduction: 25940000 },
  { from: 500000000, to: 1000000000, rate: 0.42, progressiveDeduction: 35940000 },
  { from: 1000000000, to: null, rate: 0.45, progressiveDeduction: 65940000 },
];

/**
 * 공제 항목별 연간 한도, 원 (Deductions 키별, 2025 귀속연도 기준)
 * 각 상한 <= 100,000,000 (1억)
 */
export const DEDUCTION_LIMITS: Record<keyof Deductions, number> = {
  creditCard: 3000000,
  medical: 7000000,
  education: 9000000,
  irp: 9000000,
  insurance: 1000000,
  donation: 100000000,
};

/**
 * 절세 체크리스트 기본값 (6항목 고정)
 * currentAmount/done은 진입 시 Deductions로부터 파생되기 전 초기값
 */
export const CHECKLIST_DEFAULTS: ChecklistItem[] = [
  { key: 'irp', label: 'IRP·연금저축 연 900만원 채우기', targetAmount: 9000000, currentAmount: 0, done: false },
  { key: 'pension', label: '국민연금 추가 납입 챙기기', targetAmount: 3000000, currentAmount: 0, done: false },
  { key: 'medical', label: '의료비 세액공제 영수증 모으기', targetAmount: 7000000, currentAmount: 0, done: false },
  { key: 'creditCard', label: '신용카드·체크카드 사용액 300만원 넘기기', targetAmount: 3000000, currentAmount: 0, done: false },
  { key: 'donation', label: '연말 기부금 늘리기', targetAmount: 1000000, currentAmount: 0, done: false },
  { key: 'housing', label: '주택청약·전세대출 이자상환액 채우기', targetAmount: 3000000, currentAmount: 0, done: false },
];

/**
 * 공제 항목별 절세 팁 (룰 기반 고정 문구, 참고용 정보)
 */
export const DEDUCTION_TIPS: Record<keyof Deductions, string> = {
  creditCard: '신용카드보다 체크카드·현금영수증 사용액의 공제율이 더 높아요 (신용카드 15%, 체크카드·현금영수증 30%)',
  medical: '본인·부양가족 의료비 영수증을 챙기면 15% 세액공제를 받을 수 있어요',
  education: '본인 교육비는 한도 없이 15% 세액공제돼요',
  irp: 'IRP·연금저축은 연 900만원까지 납입하면 최대 148만 5천원 세액공제를 받아요',
  insurance: '보장성보험료는 연 100만원 한도로 12% 세액공제돼요',
  donation: '기부금은 1천만원 이하 15%, 초과분은 30% 세액공제돼요',
};
