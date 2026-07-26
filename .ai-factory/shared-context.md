# Shared Context (auto-generated — do NOT modify)


## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
/**
 * TaxBackKR Type Definitions (Packet 0001)
 *
 * 모든 도메인 타입 정의 (10개 + RouteState)
 * SPEC: .ai-factory/spec.md
 */

/**
 * 소득 유형
 * @example "employee" | "freelancer" | "multi"
 */
export type IncomeType = 'employee' | 'freelancer' | 'multi';

/**
 * 사용자 세금 프로필
 * @property id - UUID v4
 * @property taxYear - 귀속연도 (예: 2025)
 * @property incomeType - 소득 유형 (직장인/프리랜서/N잡)
 * @property annualSalary - 근로소득 총급여, 원 (>= 0)
 * @property freelanceIncome - 사업/기타소득 총수입, 원 (>= 0)
 * @property dependents - 부양가족 수 (0 ~ 10, 본인 제외)
 * @property updatedAt - 마지막 수정 시각 (epoch ms)
 */
export interface TaxProfile {
  id: string;
  taxYear: number;
  incomeType: IncomeType;
  annualSalary: number;
  freelanceIncome: number;
  dependents: number;
  updatedAt: number;
}

/**
 * 공제 항목 입력값
 * 모든 필드는 >= 0 && <= 100,000,000 (1억)
 * @property creditCard - 신용카드 사용액, 원
 * @property medical - 의료비, 원
 * @property education - 교육비, 원
 * @property irp - IRP/연금저축 납입액, 원
 * @property insurance - 보장성 보험료, 원
 * @property donation - 기부금, 원
 */
export interface Deductions {
  creditCard: number;
  medical: number;
  education: number;
  irp: number;
  insurance: number;
  donation: number;
}

/**
 * 공제 항목별 분석 결과
 * @property key - Deductions 키
 * @property label - 항목명 (예: "신용카드 소득공제")
 * @property appliedAmount - 실제 적용 공제/세액공제액, 원
 * @property limit - 해당 항목 한도, 원
 * @property usedRatio - 한도 대비 사용률 (0 ~ 1)
 */
export interface DeductionBreakdownItem {
  key: keyof Deductions;
  label: string;
  appliedAmount: number;
  limit: number;
  usedRatio: number;
}

/**
 * 환급액 계산 결과
 * @property taxableIncome - 과세표준, 원 (annualSalary 이하)
 * @property calculatedTax - 산출세액, 원
 * @property prepaidTax - 기납부/원천징수세액, 원
 * @property refundAmount - 환급/추가납부액, 원 (양수 = 환급, 음수 = 추가납부)
 * @property breakdown - 공제 항목별 상세 분석 배열
 * @property needsGlobalFiling - 종합소득세 신고 대상 여부
 * @property computedAt - 계산 시각 (epoch ms)
 */
export interface TaxResult {
  taxableIncome: number;
  calculatedTax: number;
  prepaidTax: number;
  refundAmount: number;
  breakdown: DeductionBreakdownItem[];
  needsGlobalFiling: boolean;
  computedAt: number;
}

/**
 * 절세 체크리스트 항목 키 (6가지)
 * @example "irp" | "pension" | "medical" | "creditCard" | "donation" | "housing"
 */
export type ChecklistKey = 'irp' | 'pension' | 'medical' | 'creditCard' | 'donation' | 'housing';

/**
 * 절세 체크리스트 개별 항목
 * @property key - 체크리스트 항목 키
 * @property label - 항목명 (예: "IRP 연 900만원 납입")
 * @property targetAmount - 권장 한도, 원
 * @property currentAmount - 현재 달성 금액, 원 (Deductions에서 파생 또는 수동 입력)
 * @property done - 달성 여부 (currentAmount >= targetAmount)
 */
export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  targetAmount: number;
  currentAmount: number;
  done: boolean;
}

/**
 * 절세 체크리스트 전체 상태
 * @property items - 6개 항목 배열 (항상 totalCount === 6)
 * @property achievedCount - 달성한 항목 개수 (done === true인 항목 수)
 * @property totalCount - 항상 6
 * @property updatedAt - 마지막 수정 시각 (epoch ms)
 */
export interface ChecklistState {
  items: ChecklistItem[
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    constants.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- constants.ts: export interface TaxBracket; export const TAX_BRACKETS: TaxBracket[] = [; export const DEDUCTION_LIMITS: Record<keyof Deductions, number> =; export const CHECKLIST_DEFAULTS: ChecklistItem[] = [; export const DEDUCTION_TIPS: Record<keyof Deductions, string> =
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type IncomeType = 'employee' | 'freelancer' | 'multi'; export interface TaxProfile; export interface Deductions; export interface DeductionBreakdownItem; export interface TaxResult; export type ChecklistKey = 'irp' | 'pension' | 'medical' | 'creditCard' | 'donation' | 'housing'; export interface ChecklistItem; export interface ChecklistState
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd

### Module Dependencies (import graph)
  lib/constants.ts → imports: lib/types
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0002: localStorage CRUD 헬퍼 (files: src/lib/storage.ts)
- 0003: 계산 엔진 (calcTax + checkGlobalFiling) (files: src/lib/calc.ts)
- 0004: 체크리스트 파생 로직 (files: src/lib/checklist.ts)