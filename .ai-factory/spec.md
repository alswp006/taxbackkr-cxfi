# SPEC — TaxBackKR

세금 환급 시뮬레이터 (앱인토스 / Vite + React + TypeScript + TDS). 본 SPEC은 PRD를 8개 기능(F1–F8)으로 분해하며, 로그인·TDS 셋업·AdSlot/TossRewardAd/TossPurchase 래퍼는 이미 구현된 것으로 간주한다.

---

## Common Principles

- **언어**: 모든 UI 텍스트는 한국어.
- **기술 스택**: Vite + React + TypeScript, TDS(@toss/tds-mobile), react-router-dom, localStorage.
- **계산 방식**: 환급액·절세 분석은 전부 **룰 기반(순수 함수)** 로직이다. LLM/생성형 AI를 사용하지 않으므로 생성형 AI 고지 의무 대상이 **아니다** (Assumptions 참조). 단, 결과에는 "실제 신고 결과와 다를 수 있는 참고용 추정치"임을 고지한다.
- **네비게이션**: 하단 탭은 템플릿 제공 `FloatingTabBar` 사용(홈/체크리스트/기록). 화면 전환은 react-router-dom. 상단 콘텐츠 전환은 TDS `Tab`.
- **페이지 골격**: 모든 화면은 `ScreenScaffold`(PageShell)로 감싼다 — raw `div` 골격 금지.
- **터치 타깃**: 모든 인터랙티브 요소 ≥ 44px.
- **색상**: HEX 하드코딩 금지 — `var(--tds-color-*)` 또는 TDS 컴포넌트만 사용(다크모드 지원).
- **외부 이탈**: `window.location.href` / `window.open`으로 외부 URL 이동 금지. 외부 분석 SDK(GA, Amplitude 등) 금지.
- **호환성**: Android 7+, iOS 16+.
- **통화 표기**: 모든 금액은 `원` 단위, 천 단위 콤마(예: `1,240,000원`).
- **광고 배치**: 배너(AdSlot)는 콘텐츠 섹션 사이 또는 결과 하단에만 배치, 콘텐츠와 겹치지 않음. 리워드(TossRewardAd)는 절세 상세 분석 게이팅에 사용.

---

## Data Models

### TaxProfile — 사용자 입력 프로필
```typescript
type IncomeType = 'employee' | 'freelancer' | 'multi'; // 직장인 / 프리랜서 / N잡

interface TaxProfile {
  id: string;              // uuid v4
  taxYear: number;         // 귀속연도, 예: 2025
  incomeType: IncomeType;
  annualSalary: number;    // 근로소득 총급여, 원. 0 이상
  freelanceIncome: number; // 사업/기타소득 총수입, 원. 0 이상
  dependents: number;      // 부양가족 수(본인 제외). 0~10
  updatedAt: number;       // epoch ms
}
```
- 제약: `annualSalary >= 0`, `freelanceIncome >= 0`, `0 <= dependents <= 10`, `incomeType`이 `freelancer`|`multi`면 `freelanceIncome > 0` 권장(경고만).

### Deductions — 공제 항목 입력값
```typescript
interface Deductions {
  creditCard: number;   // 신용카드 사용액, 원. 0 이상
  medical: number;      // 의료비, 원. 0 이상
  education: number;    // 교육비, 원. 0 이상
  irp: number;          // IRP/연금저축 납입액, 원. 0 이상
  insurance: number;    // 보장성 보험료, 원. 0 이상
  donation: number;     // 기부금, 원. 0 이상
}
```
- 제약: 모든 필드 `>= 0`, 각 필드 상한 `100,000,000`(1억) — 초과 입력 거부.

### TaxResult — 계산 결과 (파생, 저장 시 스냅샷)
```typescript
interface DeductionBreakdownItem {
  key: keyof Deductions;
  label: string;        // 예: "신용카드 소득공제"
  appliedAmount: number;// 실제 적용 공제/세액공제액, 원
  limit: number;        // 해당 항목 한도, 원
  usedRatio: number;    // 0~1, 한도 대비 사용률
}

interface TaxResult {
  taxableIncome: number;   // 과세표준, 원
  calculatedTax: number;   // 산출세액, 원
  prepaidTax: number;      // 기납부/원천징수세액, 원
  refundAmount: number;    // + 환급 / - 추가납부, 원 (부호로 구분)
  breakdown: DeductionBreakdownItem[];
  needsGlobalFiling: boolean; // 종소세 신고 대상 여부
  computedAt: number;      // epoch ms
}
```

### ChecklistState — 절세 체크리스트
```typescript
type ChecklistKey = 'irp' | 'pension' | 'medical' | 'creditCard' | 'donation' | 'housing';

interface ChecklistItem {
  key: ChecklistKey;
  label: string;         // "IRP 연 900만원 납입"
  targetAmount: number;  // 권장 한도, 원
  currentAmount: number; // 현재 값(Deductions에서 파생 또는 수동), 원
  done: boolean;         // currentAmount >= targetAmount
}

interface ChecklistState {
  items: ChecklistItem[];
  achievedCount: number; // done === true 개수
  totalCount: number;    // 항상 6
  updatedAt: number;
}
```

### SavedRecord — 연도별 저장 스냅샷 (비교용)
```typescript
interface SavedRecord {
  id: string;            // uuid
  taxYear: number;
  profile: TaxProfile;
  deductions: Deductions;
  result: TaxResult;
  savedAt: number;
}
```

### AppMeta — 앱 메타/플래그
```typescript
interface AppMeta {
  disclaimerAcknowledged: boolean; // 참고용 추정 고지 확인 여부
  lastVisitAt: number;
  seasonBannerDismissedYear: number | null; // 시즌 배너 닫은 연도
}
```

### localStorage 키 & 크기 추정
| 키 | 값 shape | 최대 크기 추정 |
|---|---|---|
| `taxback:profile` | `TaxProfile` | ~0.3 KB |
| `taxback:deductions` | `Deductions` | ~0.2 KB |
| `taxback:checklist` | `ChecklistState` | ~1 KB |
| `taxback:records` | `SavedRecord[]` (최대 5년치) | 5 × ~2 KB = ~10 KB |
| `taxback:meta` | `AppMeta` | ~0.1 KB |
| **합계** | | **< 15 KB** (5MB 한도 대비 안전) |

- 모든 read/write는 템플릿 localStorage 헬퍼로 수행, JSON 파싱 실패 시 기본값 fallback.

---

## Feature List

### F1. 데이터 레이어 & 저장소 (Data Models + Storage)

- **Description**: 위 데이터 모델의 타입·기본값·localStorage CRUD·마이그레이션을 제공하는 순수 데이터 계층. UI 없이 저장/조회/삭제 함수와 파싱 실패 fallback을 담당한다. 이후 모든 기능이 이 계층을 통해 데이터에 접근한다.
- **Data**: TaxProfile, Deductions, ChecklistState, SavedRecord, AppMeta
- **API**: 없음 (로컬 전용)
- **Requirements**:
- AC-1 [U][P0]: The system shall `taxback:` 프리픽스로 5개 키(`profile`/`deductions`/`checklist`/`records`/`meta`)를 관리한다.
- AC-2 [E][P0]: Scenario: 프로필 저장
  - Given 유효한 `TaxProfile { taxYear: 2025, incomeType: "employee", annualSalary: 50000000, freelanceIncome: 0, dependents: 0 }`
  - When `saveProfile(profile)` 호출
  - Then `localStorage["taxback:profile"]`에 JSON으로 저장되고 `getProfile()`이 동일 객체를 반환
- AC-3 [E][P0]: Scenario: 연도 스냅샷 저장 및 최대 5개 유지
  - Given 이미 5개의 `SavedRecord`가 저장돼 있을 때
  - When 6번째 `saveRecord()` 호출
  - Then 가장 오래된(`savedAt` 최소) 레코드가 제거되고 총 5개가 유지됨
- AC-4 [W][P1]: Scenario: 손상된 JSON fallback
  - Given `localStorage["taxback:profile"]`에 `"{invalid"` 문자열이 있을 때
  - When `getProfile()` 호출
  - Then 예외를 던지지 않고 기본 프로필(`annualSalary: 0` 등)을 반환하고 `console.error` 미출력
- AC-5 [W][P1]: Scenario: 저장 용량 초과
  - Given `localStorage.setItem`이 `QuotaExceededError`를 던질 때
  - When `saveRecord()` 호출
  - Then `false`를 반환하고 호출부가 토스트 "저장 공간이 부족해요"를 표시할 수 있게 하며 앱이 크래시하지 않음
- AC-6 [U][P1]: Scenario: 최초 실행 빈 상태
  - Given 어떤 `taxback:*` 키도 없을 때
  - When 앱 초기화 시 각 getter 호출
  - Then 모든 getter가 기본값을 반환하고 `records`는 빈 배열 `[]` 반환
- AC-7 [W][P2]: The system shall `saveProfile` 시 `annualSalary < 0` 또는 `dependents > 10`이면 저장하지 않고 `false`를 반환한다.

---

### F2. 소득 입력 폼 (Income & Type Input)

- **Description**: 소득 유형(직장인/프리랜서/N잡)과 총급여·사업소득·부양가족을 입력받아 TaxProfile로 저장하는 폼 화면. 모바일 키보드에 최적화된 숫자 입력과 유효성 검사를 제공한다. 제출 시 계산 화면으로 이동한다.
- **Data**: TaxProfile
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 직장인 소득 입력 성공
  - Given 홈 화면
  - When 소득유형 `직장인` Chip 선택 후 `{ annualSalary: 50000000, dependents: 1 }` 입력하고 "환급액 계산" 버튼 탭
  - Then `TaxProfile`이 `taxback:profile`에 저장되고 `navigate('/result')` 실행
- AC-2 [E][P0]: Scenario: 프리랜서 소득 입력
  - Given 소득유형 `프리랜서` Chip 선택
  - When `{ freelanceIncome: 30000000 }` 입력 후 제출
  - Then `incomeType: "freelancer"`, `freelanceIncome: 30000000`으로 저장되고 결과 화면 이동
- AC-3 [W][P1]: Scenario: 금액 0 거부
  - Given 소득유형 `직장인` 선택
  - When `annualSalary: 0`으로 제출
  - Then 에러 메시지 "총급여를 입력해주세요"를 TextField 하단에 표시하고 네비게이션하지 않음
- AC-4 [W][P1]: Scenario: 숫자 외 입력 차단
  - Given 총급여 TextField
  - When 사용자가 `"abc"` 입력
  - Then 입력값이 반영되지 않고 필드는 마지막 유효 숫자 상태를 유지(inputMode="numeric")
- AC-5 [W][P1]: Scenario: 상한 초과 거부
  - Given 총급여 TextField
  - When `10,000,000,000`(100억 초과) 입력 후 제출
  - Then 에러 "총급여는 100억원 이하로 입력해주세요" 표시
- AC-6 [S][P1]: Scenario: 프리랜서 선택 시 필드 전환
  - While 소득유형이 `프리랜서`인 동안
  - the system shall 총급여 필드를 숨기고 사업소득 필드를 표시한다.
- AC-7 [U][P1]: Scenario: 입력 폼 로딩/복원
  - Given 이전에 저장된 `taxback:profile`이 있을 때
  - When 홈 화면 진입
  - Then 저장된 값으로 폼 필드가 프리필됨
- AC-8 [W][P1]: Scenario: 외부 이탈 금지
  - When 앱 어디서든 `window.location.href`/`window.open`으로 외부 URL 이동 시도
  - Then 해당 코드가 존재하지 않아 외부 이탈이 발생하지 않음

---

### F3. 환급액 계산 엔진 & 결과 화면 (Refund Calculation + Result)

- **Description**: TaxProfile와 Deductions를 입력받아 과세표준·산출세액·환급/추가납부액을 계산하는 순수 함수 엔진과, 핵심 숫자를 히어로로 강조하는 결과 화면을 제공한다. 결과는 참고용 추정치임을 고지한다. 절세 상세 분석은 F4의 리워드 광고로 게이팅된다.
- **Data**: TaxProfile, Deductions, TaxResult
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 환급액 계산 정확성
  - Given `TaxProfile { incomeType: "employee", annualSalary: 50000000, dependents: 0 }`와 기본 `Deductions`(모두 0)
  - When `calcTax(profile, deductions)` 호출
  - Then `TaxResult`을 반환하고 `refundAmount`가 정수(원)이며 `taxableIncome <= annualSalary`가 성립
- AC-2 [U][P0]: Scenario: 환급/추가납부 부호 구분
  - Given 계산 결과 `refundAmount = 320000`
  - When 결과 화면 렌더
  - Then SummaryHero에 "예상 환급 320,000원"이 CountUp으로 표시되고, 음수면 "추가납부 예상"으로 라벨 전환
- AC-3 [U][P0]: Scenario: 결과 카드 레이아웃 (검증 가능)
  - The system shall Result 화면에 `data-testid="refund-hero"` SummaryHero 1개와 `data-testid="summary-card"` Card 1개(과세표준·산출세액·기납부세액 ListRow 3개)를 표시하고, 핵심 값 `refundAmount`를 t2 타이포로 강조한다.
- AC-4 [U][P1]: Scenario: 참고용 추정 고지
  - The system shall 결과 화면 하단에 "실제 신고 결과와 다를 수 있는 참고용 추정치입니다" 텍스트를 항상 표시한다.
- AC-5 [W][P1]: Scenario: 소득 0일 때
  - Given `annualSalary: 0` 및 `freelanceIncome: 0`
  - When 결과 화면 진입
  - Then 계산 대신 빈 상태 `Asset.ContentIcon` + "소득을 먼저 입력해주세요" + "입력하러 가기" 버튼(→ `/`) 표시
- AC-6 [S][P1]: Scenario: 계산 로딩 상태
  - While 계산이 진행되는 동안(최소 300ms 스켈레톤)
  - the system shall SummaryHero 자리에 Skeleton을 표시한다.
- AC-7 [W][P1]: Scenario: NaN 방어
  - Given 손상된 deductions로 계산 중 `NaN` 발생 가능성
  - When `calcTax` 내부에서 `NaN` 감지
  - Then 해당 값을 `0`으로 보정하여 반환하고 `console.error` 미출력
- AC-8 [E][P2]: Scenario: 결과 저장
  - When 결과 화면에서 "올해 기록 저장" 버튼 탭
  - Then `SavedRecord`가 `saveRecord()`로 저장되고 Toast "올해 기록을 저장했어요" 표시

---

### F4. 리워드 광고 기반 절세 상세 분석 (Reward-Gated Deduction Analysis)

- **Description**: 공제 항목별(신용카드·의료비·교육비·IRP 등) 적용액과 한도 대비 사용률을 분석해 절세 여지를 보여주는 상세 화면. 리워드 광고(TossRewardAd) 시청 완료 후 분석 결과가 공개된다. 각 항목은 MiniBar로 한도 사용률을 시각화한다.
- **Data**: Deductions, TaxResult(breakdown)
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 결과 보기 전 보상형 광고
  - Given 사용자가 결과 화면에서 "절세 상세 분석 보기" 버튼 탭
  - When `TossRewardAd`(slotId=`import.meta.env.VITE_TOSS_AD_SLOT_ID`) 광고 시청 완료
  - Then 절세 분석 화면(`/analysis`)의 상세 breakdown이 표시됨
- AC-2 [S][P0]: Scenario: 광고 미시청 시 게이팅
  - While 리워드 광고를 아직 완료하지 않은 동안
  - the system shall 분석 상세 카드를 블러/잠금 처리하고 "광고 보고 분석 확인" CTA만 노출한다.
- AC-3 [U][P0]: Scenario: 항목별 breakdown 레이아웃 (검증 가능)
  - The system shall 분석 화면에 `data-testid="analysis-card"` Card 1개 안에 6개 공제 항목 ListRow를 표시하고, 각 항목에 MiniBar(`usedRatio` 0~1)와 "한도까지 N원 남음" 텍스트를 표시한다.
- AC-4 [E][P1]: Scenario: 광고 로드 실패
  - Given 리워드 광고 로드가 실패했을 때
  - When 사용자가 "광고 보고 분석 확인" 탭
  - Then Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" 표시하고 게이팅 유지, 앱 크래시 없음
- AC-5 [W][P1]: Scenario: 광고 중도 이탈
  - Given 광고 재생 중 사용자가 완료 전 닫음
  - When 광고 콜백이 미완료로 반환
  - Then 분석이 공개되지 않고 CTA가 재시도 상태로 복귀
- AC-6 [U][P1]: Scenario: 분석 데이터 빈 상태
  - Given 모든 `Deductions` 값이 0일 때
  - When 광고 시청 후 분석 화면 진입
  - Then "입력된 공제 항목이 없어요" 빈 상태와 "공제 입력하기" 버튼(→ `/simulate`) 표시
- AC-7 [U][P2]: The system shall 각 항목 절세 팁 문구를 룰 기반 상수 테이블에서 가져와 표시하고, 팁 카드에 "참고용 정보" 배지를 표시한다.

---

### F5. 공제 조정 슬라이더 실시간 시뮬레이션 (Deduction Simulation)

- **Description**: 신용카드·의료비·교육비·IRP 등 공제 항목을 슬라이더/입력으로 조정하면 환급액이 실시간으로 재계산되어 히어로 숫자가 갱신되는 화면. 조정한 Deductions는 저장되어 결과·분석에 반영된다.
- **Data**: Deductions, TaxProfile, TaxResult
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 슬라이더 조정 시 실시간 재계산
  - Given 시뮬레이션 화면, 현재 `refundAmount = 200000`
  - When IRP 입력을 `0 → 9000000`으로 변경
  - Then 상단 SummaryHero의 환급액이 300ms 이내에 재계산되어 갱신됨(디바운스 200ms)
- AC-2 [E][P0]: Scenario: 조정값 저장
  - When "적용" 버튼 탭
  - Then 변경된 `Deductions`가 `taxback:deductions`에 저장되고 Toast "공제 항목을 반영했어요" 표시
- AC-3 [U][P0]: Scenario: 시뮬레이션 히어로 레이아웃 (검증 가능)
  - The system shall 화면 상단에 `data-testid="sim-hero"` SummaryHero(환급액 CountUp, t2)를 고정 표시하고, 각 공제 항목을 Card 안 ListRow + Slider로 배치한다.
- AC-4 [W][P1]: Scenario: 슬라이더 한도 클램프
  - Given 신용카드 슬라이더 최대 `100000000`
  - When 사용자가 한도 초과 값을 시도
  - Then 값이 상한으로 클램프되고 초과 저장되지 않음
- AC-5 [W][P1]: Scenario: 소득 미입력 시 진입 차단
  - Given `taxback:profile`이 없거나 소득이 0일 때
  - When 시뮬레이션 화면 진입
  - Then "소득을 먼저 입력해주세요" 빈 상태 + "입력하러 가기" 버튼(→ `/`) 표시
- AC-6 [S][P1]: Scenario: 계산 진행 중 표시
  - While 디바운스 재계산이 진행되는 동안
  - the system shall 히어로 숫자 옆에 작은 로딩 인디케이터(Spinner)를 표시한다.
- AC-7 [W][P2]: The system shall 슬라이더 조작 시 `console.error`를 발생시키지 않는다.

---

### F6. 종합소득세 신고 대상 판단 (Global Filing Eligibility)

- **Description**: 프리랜서·부업 수입 입력을 바탕으로 종합소득세 신고 대상 여부를 룰 기반으로 판단해 결과와 근거를 안내하는 화면/섹션. 대상일 경우 신고 기간(5월) 안내와 준비 항목을 표시한다.
- **Data**: TaxProfile, TaxResult(needsGlobalFiling)
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 프리랜서 신고 대상 판정
  - Given `TaxProfile { incomeType: "freelancer", freelanceIncome: 30000000 }`
  - When `checkGlobalFiling(profile)` 호출
  - Then `needsGlobalFiling: true`를 반환하고 화면에 "종합소득세 신고 대상입니다" 배너 표시
- AC-2 [E][P0]: Scenario: 직장인 단일소득 비대상
  - Given `TaxProfile { incomeType: "employee", annualSalary: 50000000, freelanceIncome: 0 }`
  - When 판정 실행
  - Then `needsGlobalFiling: false`를 반환하고 "연말정산으로 종결됩니다" 안내 표시
- AC-3 [E][P0]: Scenario: N잡 기타소득 기준 판정
  - Given `incomeType: "multi"`, 근로소득 존재 + `freelanceIncome: 3500000`(300만원 초과)
  - When 판정 실행
  - Then `needsGlobalFiling: true`를 반환
- AC-4 [U][P1]: Scenario: 판정 근거 표시
  - The system shall 판정 결과 Card에 적용된 기준 문구(예: "기타소득 연 300만원 초과")를 근거로 표시한다.
- AC-5 [W][P1]: Scenario: 입력 부족 안내
  - Given `incomeType: "freelancer"`인데 `freelanceIncome: 0`
  - When 화면 진입
  - Then "사업소득을 입력하면 신고 대상을 판단해드려요" 안내 + 입력 유도 버튼 표시
- AC-6 [U][P1]: Scenario: 참고 고지
  - The system shall 판정 결과 하단에 "정확한 신고 대상 여부는 홈택스/세무 상담으로 확인하세요" 텍스트를 표시한다(외부 링크 없이 텍스트만).
- AC-7 [W][P2]: The system shall 신고 안내 문구에 외부 앱 설치 유도("설치","다운로드") 문구를 포함하지 않는다.

---

### F7. 절세 체크리스트 & 달성도 (Tax-Saving Checklist)

- **Description**: IRP·연금저축·의료비·기부금 등 6개 절세 항목의 권장 한도 대비 현재 달성도를 체크리스트로 표시한다. Deductions에서 값을 파생하며 달성 개수를 진행률로 시각화한다. 하단 탭의 독립 화면이다.
- **Data**: ChecklistState, Deductions
- **API**: 없음
- **Requirements**:
- AC-1 [U][P0]: Scenario: 체크리스트 6항목 구성
  - The system shall 체크리스트에 `irp`/`pension`/`medical`/`creditCard`/`donation`/`housing` 6개 항목을 항상 표시하고 `totalCount === 6`을 보장한다.
- AC-2 [E][P0]: Scenario: 달성 판정
  - Given IRP 권장 한도 `9000000`, 현재 `9000000`
  - When 체크리스트 렌더
  - Then 해당 항목 `done: true`로 표시되고 `achievedCount`에 1 반영, TDS Switch/체크 아이콘 on 상태
- AC-3 [U][P0]: Scenario: 진행률 시각화 (검증 가능)
  - The system shall 화면 상단에 `data-testid="checklist-progress"` 요소로 "N/6 달성"을 t3 타이포와 진행 바(MiniBar, `achievedCount/6`)로 표시한다.
- AC-4 [E][P1]: Scenario: 수동 값 조정
  - Given 의료비 항목
  - When 사용자가 항목 탭 후 BottomSheet에서 `2000000` 입력·저장
  - Then `taxback:checklist`와 `taxback:deductions.medical`에 반영되고 달성도 재계산
- AC-5 [U][P1]: Scenario: 빈/초기 상태
  - Given 모든 항목 `currentAmount: 0`
  - When 화면 진입
  - Then "아직 달성한 항목이 없어요. 절세를 시작해보세요" 안내와 `Asset.ContentIcon` 표시
- AC-6 [S][P1]: Scenario: 로딩 상태
  - While 체크리스트 데이터를 localStorage에서 로드하는 동안
  - the system shall 항목 자리에 Skeleton 6개를 표시한다.
- AC-7 [W][P1]: Scenario: 잘못된 저장값 방어
  - Given `taxback:checklist`의 `achievedCount`가 저장값과 실제 done 개수 불일치
  - When 화면 진입
  - Then 실제 `done` 개수로 재계산하여 표시(저장값 신뢰하지 않음)

---

### F8. 작년 데이터 비교 & 시즌 안내 (Year Comparison + Season Banner)

- **Description**: 저장된 연도별 SavedRecord를 불러와 올해와 작년 환급액을 비교 표시하고, 세금 시즌(1–5월)에 안내 배너를 노출한다. 비교 추이는 Sparkline/MiniBar로 시각화한다. 기록 관리(삭제) 기능을 포함한다.
- **Data**: SavedRecord[], AppMeta
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 연도 비교 표시
  - Given `records`에 2024년(`refundAmount: 200000`), 2025년(`refundAmount: 320000`) 스냅샷 존재
  - When 기록 화면 진입
  - Then 두 연도를 Card에 나란히 표시하고 "작년 대비 +120,000원" 차이를 강조 표기
- AC-2 [U][P0]: Scenario: 추이 시각화 (검증 가능)
  - The system shall 기록이 2개 이상일 때 `data-testid="trend-chart"` Sparkline으로 연도별 `refundAmount` 추이를 표시한다.
- AC-3 [E][P1]: Scenario: 시즌 배너 노출
  - Given 현재 월이 1~5월이고 `seasonBannerDismissedYear !== 현재연도`
  - When 홈 화면 진입
  - Then "지금은 연말정산·종소세 시즌이에요" 안내 배너 표시
- AC-4 [E][P1]: Scenario: 시즌 배너 닫기
  - When 사용자가 배너의 닫기 버튼 탭
  - Then `seasonBannerDismissedYear`에 현재연도 저장되어 같은 해 재노출 안 함
- AC-5 [U][P1]: Scenario: 기록 없음 빈 상태
  - Given `records`가 빈 배열일 때
  - When 기록 화면 진입
  - Then "저장된 기록이 없어요. 올해 결과를 저장해보세요" 안내 + `Asset.ContentIcon` 표시
- AC-6 [E][P1]: Scenario: 기록 삭제
  - Given 기록 목록
  - When 항목 삭제 후 AlertDialog "삭제할까요?"에서 확인 탭
  - Then 해당 `SavedRecord`가 `records`에서 제거되고 Toast "기록을 삭제했어요" 표시
- AC-7 [W][P1]: Scenario: 단일 연도 비교 방어
  - Given `records`에 1개 스냅샷만 있을 때
  - When 화면 진입
  - Then "비교하려면 다음 해 기록이 필요해요" 안내를 표시하고 Sparkline은 렌더하지 않음(NaN 방지)

---

## Screen Definitions

### S1. 홈 / 소득 입력 — `/` (F2, F8 시즌 배너)
- **TDS 컴포넌트**: `ScreenScaffold`(PageShell), `Top`(타이틀), `Chip`(소득유형 3종), `TextField`(총급여/사업소득/부양가족, `inputMode="numeric"`), `Paragraph.Text`, `Button`(하단 고정 SubmitFooter, `display="block"`, "환급액 계산"), 시즌 배너용 `ListRow`+닫기 아이콘 버튼, `FloatingTabBar`.
- **로딩/빈/에러**: 저장 프로필 로드 중 필드 Skeleton / 초기값 0 / 유효성 에러는 TextField 하단 헬퍼 텍스트.
- **터치**: Chip·버튼·닫기 아이콘 ≥ 44px. 키보드: 숫자 키패드, "완료" 시 blur, 하단 버튼은 키보드 위로 밀리지 않게 SubmitFooter 고정.
- **레이아웃 계약**: SubmitFooter 하단 고정 1차 액션, 입력은 Card 그룹.
- **Navigation contract**:
  - Outgoing: "환급액 계산 버튼 → `navigate('/result')`" (프로필은 localStorage로 전달, state 없음).
  - Incoming: `location.state = undefined`.

### S2. 결과 — `/result` (F3, F6 요약 섹션)
- **TDS 컴포넌트**: `ScreenScaffold`, `Top`, SummaryHero(`data-testid="refund-hero"`, CountUp, t2), `Card`(`data-testid="summary-card"`, ListRow 3개: 과세표준/산출세액/기납부세액), 종소세 판정 `Card`+`Chip` 배지, `Paragraph.Text`(참고 고지), `Button`(`display="block"`, "절세 상세 분석 보기"), `AdSlot`(결과 카드 하단), `FloatingTabBar`.
- **로딩/빈/에러**: 계산 중 Skeleton 히어로(최소 300ms) / 소득 0이면 `Asset.ContentIcon` 빈 상태 + "입력하러 가기" / NaN 보정.
- **터치**: 모든 버튼 ≥ 44px.
- **레이아웃 계약**: SummaryHero 히어로 + summary Card 위계, 배너는 콘텐츠와 겹치지 않게 하단.
- **Navigation contract**:
  - Outgoing: "절세 상세 분석 보기 → `navigate('/analysis')`"; "시뮬레이션 → `navigate('/simulate')`".
  - Incoming: `location.state = undefined` (프로필/공제는 localStorage).

### S3. 절세 상세 분석 — `/analysis` (F4)
- **TDS 컴포넌트**: `ScreenScaffold`, `Top`, `TossRewardAd`(게이팅 래퍼, slotId=env), `Card`(`data-testid="analysis-card"`), `ListRow`×6 + MiniBar(usedRatio), `Chip`("참고용 정보" 배지), `Button`("광고 보고 분석 확인" / "공제 입력하기"), `Toast`.
- **로딩/빈/에러**: 광고 로딩 중 CTA disabled+Spinner / 공제 전부 0이면 빈 상태 / 광고 실패 시 Toast + 게이팅 유지.
- **터치**: CTA ≥ 44px.
- **레이아웃 계약**: 미시청 시 상세 Card 블러+잠금, 시청 후 공개.
- **Navigation contract**:
  - Outgoing: "공제 입력하기 → `navigate('/simulate')`".
  - Incoming: `location.state = undefined`.

### S4. 공제 시뮬레이션 — `/simulate` (F5)
- **TDS 컴포넌트**: `ScreenScaffold`, `Top`, SummaryHero(`data-testid="sim-hero"`, CountUp), `Card`+`ListRow`+`Slider`(공제 항목별), `Spinner`(재계산 인디케이터), `Button`(하단 고정 "적용"), `Toast`.
- **로딩/빈/에러**: 재계산 중 Spinner / 소득 미입력 시 빈 상태 + "입력하러 가기" / 한도 클램프.
- **터치**: 슬라이더 핸들·버튼 ≥ 44px. 디바운스 200ms.
- **레이아웃 계약**: 상단 히어로 고정, 항목은 Card 그룹.
- **Navigation contract**:
  - Outgoing: "적용 후 결과로 → `navigate('/result')`" (선택).
  - Incoming: `location.state = undefined`.

### S5. 절세 체크리스트 — `/checklist` (F7)
- **TDS 컴포넌트**: `ScreenScaffold`, `Top`, 진행 요약(`data-testid="checklist-progress"`, t3 + MiniBar), `ListRow`×6 + `Switch`/체크 아이콘, `BottomSheet`(값 조정 입력 `TextField`), `Button`(저장), `Toast`, `FloatingTabBar`.
- **로딩/빈/에러**: 로드 중 Skeleton 6개 / 전부 0이면 빈 상태 / 저장값 불일치 재계산.
- **터치**: ListRow·Switch·BottomSheet 입력 ≥ 44px. 키보드: BottomSheet 숫자 입력, 열릴 때 입력 필드가 키보드에 가리지 않게 상단 배치.
- **Navigation contract**: Incoming `location.state = undefined`. Outgoing: BottomSheet는 라우팅 없이 인앱 오버레이.

### S6. 기록 & 비교 — `/records` (F8)
- **TDS 컴포넌트**: `ScreenScaffold`, `Top`, Sparkline(`data-testid="trend-chart"`), `Card`(연도별 비교, 차이 강조 t2), `ListRow`(기록 목록), `AlertDialog`(삭제 확인), `Button`, `Toast`, `FloatingTabBar`.
- **로딩/빈/에러**: 로드 중 Skeleton / 기록 없음 빈 상태 `Asset.ContentIcon` / 단일 연도면 Sparkline 미렌더 안내.
- **터치**: 삭제 버튼·목록 항목 ≥ 44px. 목록 5개 이하이므로 일반 스크롤(가상 스크롤 불필요).
- **Navigation contract**: Incoming `location.state = undefined`. Outgoing: "결과 보기 → `navigate('/result')`".

---

## API Contract

외부 API 없음. 모든 계산·저장은 클라이언트 순수 함수 + localStorage로 처리한다.

- **CORS/네트워크 관련 AC (전역)**:
  - AC-G1 [U][P0]: The system shall 외부 HTTP 요청을 수행하지 않아 CORS 에러가 0개다.
  - AC-G2 [U][P0]: The system shall 프로덕션 빌드에서 `console.error`를 출력하지 않는다(에러 0개).
  - AC-G3 [W][P0]: The system shall `window.location.href`/`window.open`로 외부 URL 이동을 수행하지 않는다.
  - AC-G4 [W][P0]: The system shall Google Analytics/Amplitude 등 외부 로깅 SDK를 포함하지 않는다.
  - AC-G5 [U][P0]: The system shall HEX 색상을 하드코딩하지 않고 `var(--tds-color-*)`/TDS 컴포넌트만 사용해 다크모드를 지원한다.
  - AC-G6 [U][P1]: The system shall Android 7+/iOS 16+ 호환을 위해 최신 전용 API를 사용하지 않는다.

> 향후 서버 영속화가 필요할 경우 별도 Railway API 서버로 분리하고, 응답 에러는 통일 shape `{ error: string }`를 사용한다. 본 MVP 범위 아님.

---

## Assumptions

1. **생성형 AI 미사용**: 환급 계산·절세 팁·종소세 판정은 전부 룰 기반 순수 함수와 상수 테이블이다. LLM/생성형 모델을 호출하지 않으므로 생성형 AI 고지 의무(사전 고지/결과물 라벨) 대상이 아니다. 대신 모든 결과에 "참고용 추정치" 고지를 표시한다.
2. **세율/공제 상수**: 과세표준 구간·세율·공제 한도는 특정 귀속연도(기본 2025) 기준 상수 테이블로 하드코딩하며, 실제 신고와 오차가 있을 수 있음을 고지한다.
3. **인증**: 토스 세션이 자동 제공되며 별도 로그인 로직 없음. 사용자 식별이 필요 없으므로 `getIsTossLoginIntegratedService()` 호출은 선택.
4. **프로모션 미사용**: 본 MVP는 수익모델이 광고이며 `grantPromotionReward`를 사용하지 않는다. 추후 사용 시 `amount ≤ 5000` 검증.
5. **광고 ID**: `VITE_TOSS_AD_GROUP_ID`(배너), `VITE_TOSS_AD_SLOT_ID`(리워드)는 앱인토스 콘솔에서 env로 주입.
6. **저장 한도**: 연도 스냅샷 최대 5개 유지로 localStorage 15KB 미만, 5MB 한도 대비 안전.

## Open Questions

1. 세율·공제 상수의 귀속연도를 매년 수동 업데이트할지, 외부 API로 받아올지(현재는 상수 하드코딩 가정).
2. 종소세 신고 대상 판정 기준(기타소득 300만원 등)의 정확한 룰 세트 범위 — 세무 검토 필요.
3. 시즌 배너에서 홈택스 등 공공기관 링크를 텍스트 안내로만 둘지, 허용 범위 내 링크를 둘지(현재는 텍스트만).
4. 리워드 광고 재시청 정책(하루 N회 제한) 필요 여부.