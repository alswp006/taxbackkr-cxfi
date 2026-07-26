Looking at this, the real defect isn't documentation truncation (that's the validator complaining about not seeing full docs — which I'm now providing) — it's that the proposed fix has a **latent bug**: Task 3.1's `HomePage.tsx` statically renders `<SeasonBanner />`, but the component file is created later in Task 4.2. The note "컴포넌트가 없으면 렌더링을 생략해도 컴파일 유지" is not actually implementable with a static import — the first agent to run Task 3.1 hits a TS module-resolution error and the build fails.

The clean resolution: build `SeasonBanner` **first** as its own UI task, and make `HomePage` **depend on it**. Then every file is owned by exactly one task (no re-conflict), and there is no phantom import. Below is the complete corrected TASK.

---

# TASK — TaxBackKR

모든 화면 데이터는 localStorage로 전달되며, Screen Definitions의 Navigation contract상 `location.state`는 전부 `undefined`다. 그러나 지침에 따라 `RouteState` 타입을 반드시 정의하고 각 페이지가 이를 import해 타입 안전성을 보장한다.

**파일 소유권 원칙**: 모든 소스 파일은 정확히 **1개 Task**만 생성/수정한다. `SeasonBanner`는 자립형 컴포넌트로 **HomePage보다 먼저** 구현하고(Task 3.1), `HomePage`(Task 3.2)가 이를 import해 렌더한다 — 이로써 (a) `HomePage.tsx` 파일 충돌 제거, (b) 존재하지 않는 모듈 import로 인한 컴파일 실패(phantom import) 원천 차단.

---

## Epic 1. Data Layer

**Risk 평가**
- Complexity: Medium
- Risk factors: (1) 세율/공제 상수 오류 시 전 화면 계산 왜곡, (2) `NaN`/손상 JSON 전파, (3) records 5개 초과 시 QuotaExceeded, (4) checklist `achievedCount` 저장값과 실제 done 불일치.
- Mitigation: 타입(1.1)→상수(1.2)→저장소(1.3)→계산엔진(1.4)→파생로직(1.5) 순으로 하위 의존을 먼저 고정. 순수 함수 계층을 UI보다 먼저 완성해 페이지는 검증된 데이터에만 의존. NaN 보정·fallback을 저장/계산 단에서 원천 차단.

### Task 1.1 TypeScript 타입 & RouteState 정의
- Description: SPEC의 모든 엔티티 타입(`IncomeType`, `TaxProfile`, `Deductions`, `DeductionBreakdownItem`, `TaxResult`, `ChecklistKey`, `ChecklistItem`, `ChecklistState`, `SavedRecord`, `AppMeta`)과 페이지 간 계약 `RouteState`를 순수 타입으로 정의한다. 런타임 코드 없음.
- DoD:
  - `src/lib/types.ts`가 위 10개 타입을 export하고 `tsc --noEmit` 통과.
  - `RouteState` 타입 정의: `export type RouteState = { "/": undefined; "/result": undefined; "/analysis": undefined; "/simulate": undefined; "/checklist": undefined; "/records": undefined; }` (모든 라우트 state는 undefined — 데이터는 localStorage 경유).
  - 각 필드에 SPEC 제약(단위·범위) JSDoc 주석 포함.
- Covers: [F1-AC1(타입 정의부), F6-AC6(needsGlobalFiling 필드), AC-G6]
- Files: [`src/lib/types.ts`]
- Depends on: none

### Task 1.2 세율·공제·체크리스트 상수 테이블
- Description: 귀속연도 2025 기준 과세표준 구간·세율, 공제 항목별 한도(각 1억 상한 포함), 체크리스트 6항목 권장 한도/라벨, 항목별 절세 팁 문구 상수 테이블을 정의한다. HEX 색상 미포함(순수 데이터).
- DoD:
  - `src/lib/constants.ts`가 `TAX_BRACKETS`, `DEDUCTION_LIMITS`(`keyof Deductions`별), `CHECKLIST_DEFAULTS`(6개, `totalCount=6`), `DEDUCTION_TIPS`(항목별 문구+"참고용 정보") export.
  - `DEDUCTION_LIMITS`의 각 상한 ≤ `100000000`.
  - `tsc --noEmit` 통과, 앱 컴파일 유지.
- Covers: [F4-AC7(팁 상수 소스), F7-AC1(6항목 기본값 소스)]
- Files: [`src/lib/constants.ts`]
- Depends on: Task 1.1

### Task 1.3 localStorage CRUD 헬퍼
- Description: `taxback:` 프리픽스 5키(`profile`/`deductions`/`checklist`/`records`/`meta`)의 read/write/기본값 fallback/QuotaExceeded 방어를 담당하는 순수 함수 계층. 템플릿 localStorage 헬퍼 위에서 동작.
- DoD:
  - `getProfile/saveProfile`, `getDeductions/saveDeductions`, `getChecklist/saveChecklist`, `getRecords/saveRecord`, `getMeta/saveMeta` export.
  - `saveProfile`: `annualSalary<0` 또는 `dependents>10`이면 저장 안 하고 `false` 반환(F1-AC7).
  - `saveRecord`: 6번째 저장 시 `savedAt` 최소 레코드 제거 후 최대 5개 유지(F1-AC3); `setItem`이 `QuotaExceededError`면 `false` 반환·크래시 없음(F1-AC5).
  - 손상 JSON(`"{invalid"`) 시 예외 없이 기본값 반환, `console.error` 미출력(F1-AC4).
  - 키 부재 시 모든 getter 기본값, `getRecords()`는 `[]`(F1-AC6).
  - `getMeta()`는 `seasonBannerDismissedYear: null` 기본값 포함, `saveMeta`는 부분 병합 지원(F8-AC4 소스).
- Covers: [F1-AC1, F1-AC2, F1-AC3, F1-AC4, F1-AC5, F1-AC6, F1-AC7]
- Files: [`src/lib/storage.ts`]
- Depends on: Task 1.1, Task 1.2

### Task 1.4 계산 엔진 (calcTax + checkGlobalFiling)
- Description: `TaxProfile`+`Deductions`→`TaxResult`를 산출하는 순수 함수와 종소세 대상 판정 함수. NaN 방어·breakdown 생성 포함.
- DoD:
  - `calcTax(profile, deductions): TaxResult` — `refundAmount` 정수(원), `taxableIncome <= annualSalary` 성립, 6항목 `breakdown`(각 `usedRatio` 0~1) 생성(F3-AC1).
  - 내부 `NaN` 감지 시 해당 값 `0` 보정·`console.error` 미출력(F3-AC7).
  - `checkGlobalFiling(profile): boolean` — freelancer(freelanceIncome>0)→true(F6-AC1); employee 단일소득→false(F6-AC2); multi & 기타소득 300만원 초과→true(F6-AC3); 판정 근거 문자열 반환 함수 포함.
  - `TaxResult.needsGlobalFiling`에 판정 반영.
  - 단위 테스트 3케이스(F3-AC1/F6-AC1/F6-AC2) 통과, 컴파일 유지.
- Covers: [F3-AC1, F3-AC7, F6-AC1, F6-AC2, F6-AC3]
- Files: [`src/lib/calc.ts`]
- Depends on: Task 1.1, Task 1.2

### Task 1.5 체크리스트 파생 로직
- Description: `Deductions`에서 `ChecklistState`를 파생/재계산하는 순수 함수. 저장값을 신뢰하지 않고 실제 done 개수로 `achievedCount` 재산출.
- DoD:
  - `deriveChecklist(deductions, storedChecklist?): ChecklistState` — 항상 6항목·`totalCount===6`(F7-AC1).
  - `currentAmount >= targetAmount`면 `done:true`, `achievedCount`에 반영(F7-AC2).
  - 저장된 `achievedCount`가 실제 done 개수와 불일치 시 실제값으로 재계산(F7-AC7).
  - 컴파일 유지, `console.error` 미발생.
- Covers: [F7-AC1, F7-AC2, F7-AC7]
- Files: [`src/lib/checklist.ts`]
- Depends on: Task 1.1, Task 1.2, Task 1.4

---

## Epic 2. API Routes

외부 API 없음 (API Contract 참조). 모든 계산·저장은 클라이언트 순수 함수 + localStorage. 별도 Task 불필요. 전역 네트워크 관련 AC(G1~G4)는 Epic 4에서 감사·검증한다.

---

## Epic 3. UI Pages

**Risk 평가**
- Complexity: High
- Risk factors: (1) 히어로/카드 `data-testid` 누락 시 검수 반려, (2) TDS 여백을 Tailwind로 덮어써 UI 깨짐, (3) 빈/로딩/에러 상태 누락, (4) 리워드 광고 게이팅 상태 관리 버그, (5) HomePage가 미존재 컴포넌트를 import해 컴파일 실패.
- Mitigation: 데이터 계층(Epic 1)이 완성된 후 페이지를 1개씩 구현. **`SeasonBanner`(3.1)를 HomePage(3.2)보다 먼저 완성**해 phantom import를 차단하고 파일 소유권을 1 Task로 고정(`SeasonBanner.tsx`는 3.1만, `HomePage.tsx`는 3.2만 소유). 각 페이지는 `ScreenScaffold`로 감싸고 TDS 컴포넌트만 조립, 간격은 `Spacing`만 사용.

### Task 3.1 시즌 배너 자립형 컴포넌트 (SeasonBanner)
- Description: 세금 시즌(1~5월) 배너를 **props 없는 자립형 컴포넌트**로 구현한다. 컴포넌트 내부에서 `AppMeta`를 읽어 노출 여부를 판단하고, 닫기 시 `seasonBannerDismissedYear`로 연 1회 재노출을 제어한다. HomePage(3.2)보다 먼저 완성되어, HomePage가 정상 import·렌더할 수 있게 한다.
- DoD:
  - `src/components/SeasonBanner.tsx`가 props 없이 자체적으로 노출 여부 결정: 현재 월 1~5월이고 `getMeta().seasonBannerDismissedYear !== 현재연도`일 때만 "지금은 연말정산·종소세 시즌이에요" `ListRow` 배너 렌더, 그 외에는 `null` 반환(F8-AC3).
  - 닫기 버튼 탭 시 `saveMeta`로 `seasonBannerDismissedYear`에 현재연도 저장→즉시 숨김·같은 해 재노출 안 함(F8-AC4).
  - 닫기 아이콘 ≥44px, HEX 하드코딩 없음(`var(--tds-color-*)`/TDS만).
  - 단독 렌더 시 `tsc --noEmit` 통과, `console.error` 미발생.
- Covers: [F8-AC3, F8-AC4]
- Files: [`src/components/SeasonBanner.tsx`]
- Depends on: Task 1.3

### Task 3.2 홈 / 소득 입력 페이지 (`/`)
- Description: 소득유형 Chip(직장인/프리랜서/N잡)과 총급여·사업소득·부양가족 입력 폼. 유효성 검사 후 `TaxProfile` 저장 및 `/result` 이동. 저장 프로필 프리필. 상단 슬롯에 기존 `<SeasonBanner />`(Task 3.1 소유)를 import해 렌더 — 배너 표시/닫기 로직은 컴포넌트 내부에 있으므로 이 Task는 배치만 한다.
- DoD:
  - 직장인 선택+`{annualSalary:50000000, dependents:1}` 제출 → `saveProfile` 후 `navigate('/result')`(F2-AC1).
  - 프리랜서 선택+`{freelanceIncome:30000000}` → `incomeType:"freelancer"` 저장·이동(F2-AC2).
  - 직장인 `annualSalary:0` 제출 → TextField 하단 "총급여를 입력해주세요", 이동 안 함(F2-AC3).
  - `inputMode="numeric"`, 비숫자 입력 미반영(F2-AC4); 100억 초과 → "총급여는 100억원 이하로 입력해주세요"(F2-AC5).
  - 프리랜서 동안 총급여 필드 숨김·사업소득 필드 표시(F2-AC6).
  - 진입 시 저장된 `taxback:profile`로 프리필(F2-AC7).
  - 외부 이탈 코드(`window.location.href`/`window.open`) 부재(F2-AC8).
  - `ScreenScaffold`+`Top`+상단 `<SeasonBanner />`(정상 import)+하단 고정 `Button`("환급액 계산"), Chip·버튼 ≥44px, `FloatingTabBar` 포함.
- Covers: [F2-AC1, F2-AC2, F2-AC3, F2-AC4, F2-AC5, F2-AC6, F2-AC7, F2-AC8]
- Files: [`src/pages/HomePage.tsx`]
- Depends on: Task 1.3, Task 1.4, Task 3.1

### Task 3.3 결과 페이지 (`/result`) + 종소세 판정 섹션
- Description: `calcTax` 결과를 히어로+요약 카드로 표시하고 종소세 대상 판정 섹션(F6 display)과 참고 고지, 기록 저장 버튼을 포함.
- DoD:
  - `refundAmount` 부호별 "예상 환급 N원" CountUp / 음수 시 "추가납부 예상" 라벨 전환(F3-AC2).
  - `data-testid="refund-hero"` SummaryHero 1개 + `data-testid="summary-card"` Card(과세표준·산출세액·기납부세액 ListRow 3개), `refundAmount` t2 강조(F3-AC3).
  - 하단 "실제 신고 결과와 다를 수 있는 참고용 추정치입니다" 상시 표시(F3-AC4).
  - 소득 0 시 `Asset.ContentIcon`+"소득을 먼저 입력해주세요"+"입력하러 가기"(→`/`)(F3-AC5).
  - 계산 중 최소 300ms Skeleton 히어로(F3-AC6).
  - "올해 기록 저장" → `saveRecord` + Toast "올해 기록을 저장했어요"(F3-AC8).
  - 종소세 판정 Card에 근거 문구 표시(F6-AC4); freelancer & freelanceIncome:0 시 "사업소득을 입력하면 신고 대상을 판단해드려요"+입력 유도(F6-AC5); 하단 "정확한 신고 대상 여부는 홈택스/세무 상담으로 확인하세요"(외부 링크 없음)(F6-AC6); 안내 문구에 "설치"/"다운로드" 미포함(F6-AC7).
  - "절세 상세 분석 보기"→`navigate('/analysis')`; 시뮬레이션→`navigate('/simulate')`.
- Covers: [F3-AC2, F3-AC3, F3-AC4, F3-AC5, F3-AC6, F3-AC8, F6-AC4, F6-AC5, F6-AC6, F6-AC7]
- Files: [`src/pages/ResultPage.tsx`]
- Depends on: Task 1.3, Task 1.4

### Task 3.4 절세 상세 분석 페이지 (`/analysis`)
- Description: `TossRewardAd` 게이팅 후 공제 6항목 breakdown을 MiniBar로 시각화. 광고 실패/중도 이탈 방어, 빈 상태, 팁 배지 포함.
- DoD:
  - "절세 상세 분석 보기"→`TossRewardAd`(slotId=`import.meta.env.VITE_TOSS_AD_SLOT_ID`) 완료 후 상세 breakdown 공개(F4-AC1).
  - 미시청 동안 상세 Card 블러/잠금+"광고 보고 분석 확인" CTA만 노출(F4-AC2).
  - `data-testid="analysis-card"` Card 안 6개 공제 ListRow, 각 MiniBar(`usedRatio` 0~1)+"한도까지 N원 남음"(F4-AC3).
  - 광고 로드 실패 시 Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"+게이팅 유지·크래시 없음(F4-AC4).
  - 광고 중도 이탈 시 미공개·CTA 재시도 복귀(F4-AC5).
  - Deductions 전부 0 시 "입력된 공제 항목이 없어요"+"공제 입력하기"(→`/simulate`)(F4-AC6).
  - 항목별 팁을 `DEDUCTION_TIPS`에서 가져와 "참고용 정보" 배지와 표시(F4-AC7).
- Covers: [F4-AC1, F4-AC2, F4-AC3, F4-AC4, F4-AC5, F4-AC6, F4-AC7]
- Files: [`src/pages/AnalysisPage.tsx`]
- Depends on: Task 1.3, Task 1.4, Task 1.2

### Task 3.5 공제 시뮬레이션 페이지 (`/simulate`)
- Description: 공제 항목 Slider 조정 시 환급액 실시간 재계산(디바운스 200ms)되는 히어로 화면. 조정값 저장·한도 클램프·소득 미입력 차단. **F3(슬라이더 실시간 시뮬레이션 UI)의 소유 Task.**
- DoD:
  - IRP `0→9000000` 변경 시 300ms 이내 SummaryHero 갱신(디바운스 200ms)(F5-AC1).
  - "적용"→변경 `Deductions`를 `taxback:deductions` 저장+Toast "공제 항목을 반영했어요"(F5-AC2).
  - `data-testid="sim-hero"` SummaryHero(CountUp, t2) 고정 + 항목별 Card+ListRow+Slider(F5-AC3).
  - 신용카드 상한 `100000000` 초과 시 클램프·초과 저장 안 함(F5-AC4).
  - 소득 없거나 0 시 "소득을 먼저 입력해주세요"+"입력하러 가기"(→`/`)(F5-AC5).
  - 재계산 중 히어로 옆 Spinner(F5-AC6).
  - 슬라이더 조작 시 `console.error` 미발생(F5-AC7).
  - 슬라이더 변경마다 `calcTax`(Task 1.4)를 재호출해 히어로에 반영(F3 실시간 시뮬레이션 요건).
- Covers: [F5-AC1, F5-AC2, F5-AC3, F5-AC4, F5-AC5, F5-AC6, F5-AC7]
- Files: [`src/pages/SimulatePage.tsx`]
- Depends on: Task 1.3, Task 1.4

### Task 3.6 절세 체크리스트 페이지 (`/checklist`)
- Description: `deriveChecklist` 결과 6항목을 진행률·Switch로 표시하고 BottomSheet로 수동 값 조정. 빈/로딩 상태 처리. (6항목/done 판정/재계산 로직은 Task 1.5 소유.)
- DoD:
  - `data-testid="checklist-progress"` 요소로 "N/6 달성" t3+MiniBar(`achievedCount/6`)(F7-AC3).
  - 의료비 항목 탭→BottomSheet에서 `2000000` 저장 시 `taxback:checklist`와 `taxback:deductions.medical` 반영·달성도 재계산(F7-AC4).
  - 전부 `currentAmount:0` 시 "아직 달성한 항목이 없어요. 절세를 시작해보세요"+`Asset.ContentIcon`(F7-AC5).
  - 로드 중 Skeleton 6개(F7-AC6).
  - ListRow·Switch·BottomSheet 입력 ≥44px, `FloatingTabBar` 포함.
- Covers: [F7-AC3, F7-AC4, F7-AC5, F7-AC6]
- Files: [`src/pages/ChecklistPage.tsx`]
- Depends on: Task 1.3, Task 1.5

### Task 3.7 기록 & 비교 페이지 (`/records`)
- Description: 저장된 `SavedRecord[]`로 연도별 환급액 비교·추이(Sparkline) 표시, 삭제(AlertDialog) 기능. 단일 연도 방어.
- DoD:
  - 2024(200000)·2025(320000) 존재 시 두 연도 Card 나란히+"작년 대비 +120,000원" 강조(F8-AC1).
  - 기록 2개 이상일 때 `data-testid="trend-chart"` Sparkline로 연도별 `refundAmount` 추이(F8-AC2).
  - `records` 빈 배열 시 "저장된 기록이 없어요. 올해 결과를 저장해보세요"+`Asset.ContentIcon`(F8-AC5).
  - 항목 삭제→AlertDialog "삭제할까요?" 확인 시 `records`에서 제거+Toast "기록을 삭제했어요"(F8-AC6).
  - 기록 1개일 때 "비교하려면 다음 해 기록이 필요해요" 안내·Sparkline 미렌더(NaN 방지)(F8-AC7).
  - "결과 보기"→`navigate('/result')`, `FloatingTabBar` 포함.
- Covers: [F8-AC1, F8-AC2, F8-AC5, F8-AC6, F8-AC7]
- Files: [`src/pages/RecordsPage.tsx`]
- Depends on: Task 1.3

---

## Epic 4. Integration + Landing

**Risk 평가**
- Complexity: Medium
- Risk factors: (1) 라우트/탭 미연결로 화면 도달 불가, (2) 배너 광고가 콘텐츠와 겹쳐 검수 반려, (3) HEX 하드코딩·`console.error`·외부 SDK 잔존으로 전역 AC 위반.
- Mitigation: 모든 페이지 완성 후 라우팅·탭·광고·전역 감사를 마지막에 수행. 전역 AC(G1~G6)를 단일 감사 Task로 집중 점검. 시즌 배너는 Epic 3에서 이미 자립형 컴포넌트로 완결되어 이 Epic에서는 손대지 않는다.

### Task 4.1 라우팅 & FloatingTabBar 배선
- Description: react-router-dom으로 6개 라우트(`/`,`/result`,`/analysis`,`/simulate`,`/checklist`,`/records`) 연결, `FloatingTabBar`(홈/체크리스트/기록) 배치, 각 페이지 `location.state`를 `RouteState`로 타입 캐스팅.
- DoD:
  - `src/App.tsx`에 6개 `<Route>` 등록, 미지정 경로는 `/`로 리다이렉트.
  - 홈/체크리스트/기록 탭이 `FloatingTabBar`에서 해당 라우트로 이동.
  - 각 페이지가 `RouteState` import해 `location.state`(모두 `undefined`) 타입 안전 접근.
  - 앱 빌드·전 페이지 도달 확인.
- Covers: [F2-AC1(navigate 목적지 존재), F3-AC5(→`/` 링크), F4-AC6(→`/simulate`), F5-AC5(→`/`)]
- Files: [`src/App.tsx`, `src/routes.tsx`]
- Depends on: Task 3.2, Task 3.3, Task 3.4, Task 3.5, Task 3.6, Task 3.7

### Task 4.2 광고 배치 & 전역 규정 감사
- Description: 결과 화면 하단 `AdSlot`(콘텐츠 비겹침) 배치 확인, 그리고 전역 네트워크/색상/호환 AC를 최종 감사·수정.
- DoD:
  - 결과 카드 하단 `AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID}` 배치, 콘텐츠와 미겹침.
  - 외부 HTTP 요청 0개·CORS 에러 0개(전역 grep 확인)(AC-G1).
  - 프로덕션 빌드에서 `console.error` 0개(AC-G2).
  - `window.location.href`/`window.open` 외부 이동 코드 부재(AC-G3).
  - GA/Amplitude 등 외부 로깅 SDK 미포함(AC-G4).
  - 전 코드 HEX 하드코딩 0개, `var(--tds-color-*)`/TDS만 사용해 다크모드 지원(AC-G5).
  - 최신 전용 API 미사용(Android 7+/iOS 16+ 호환)(AC-G6).
- Covers: [AC-G1, AC-G2, AC-G3, AC-G4, AC-G5, AC-G6]
- Files: [`src/pages/ResultPage.tsx`, 전역 감사(수정 시 해당 파일)]
- Depends on: Task 4.1

---

## AC Coverage

- Total ACs in SPEC: **64** (F1:7, F2:8, F3:8, F4:7, F5:7, F6:7, F7:7, F8:7, Global:6)
- Covered by tasks: **64**
  - F1-AC1→1.1/1.3, AC2~AC7→1.3
  - F2-AC1~AC8→3.2 (AC1 목적지 4.1 보강)
  - F3-AC1·AC7→1.4; AC2·AC3·AC4·AC5·AC6·AC8→3.3 (AC5 링크 4.1); **F3 실시간 슬라이더 시뮬레이션 UI→3.5**
  - F4-AC1~AC6→3.4; AC7→3.4(상수 1.2)
  - F5-AC1~AC7→3.5 (AC5 링크 4.1)
  - F6-AC1·AC2·AC3→1.4; AC4·AC5·AC6·AC7→3.3; AC6(needsGlobalFiling 필드)→1.1
  - F7-AC1·AC2·AC7→1.5; AC3·AC4·AC5·AC6→3.6
  - F8-AC1·AC2·AC5·AC6·AC7→3.7; **AC3·AC4→3.1(SeasonBanner)**
  - AC-G1~G6→4.2; AC-G6→1.1 보강
- Uncovered: **0** ✅

## 파일 소유권 매트릭스 (충돌 0 검증)

| 파일 | 소유 Task |
|---|---|
| `src/lib/types.ts` | 1.1 |
| `src/lib/constants.ts` | 1.2 |
| `src/lib/storage.ts` | 1.3 |
| `src/lib/calc.ts` | 1.4 |
| `src/lib/checklist.ts` | 1.5 |
| `src/components/SeasonBanner.tsx` | **3.1 (단독)** |
| `src/pages/HomePage.tsx` | **3.2 (단독)** |
| `src/pages/ResultPage.tsx` | 3.3 (+4.2 광고 감사) |
| `src/pages/AnalysisPage.tsx` | 3.4 |
| `src/pages/SimulatePage.tsx` | 3.5 |
| `src/pages/ChecklistPage.tsx` | 3.6 |
| `src/pages/RecordsPage.tsx` | 3.7 |
| `src/App.tsx`, `src/routes.tsx` | 4.1 |

> `ResultPage.tsx`는 3.3(생성)과 4.2(광고 배치·감사)가 순차(4.2 depends 4.1 depends 3.3) 접촉하지만 병렬 편집 아님. 그 외 모든 파일은 **정확히 1 Task**가 생성. `HomePage.tsx`를 두 Task가 편집하는 원래 충돌은 완전히 제거됨.

---

## 변경 사항 요약 (이전 버전 대비)

1. **HomePage.tsx 파일 충돌 + phantom import 동시 해소**: `SeasonBanner`를 Epic 4(4.2)에서 Epic 3의 **첫 UI Task(3.1)** 로 이동. HomePage(3.2)가 `SeasonBanner`에 `Depends on`으로 걸려, 컴포넌트가 **먼저 존재**한 뒤 import·렌더된다 → 존재하지 않는 모듈 import로 인한 컴파일 실패 위험 제거. HomePage.tsx는 3.2 단독 소유, SeasonBanner.tsx는 3.1 단독 소유.
2. **Epic 3 재번호**: 3.1 SeasonBanner → 3.2 Home → 3.3 Result → 3.4 Analysis → 3.5 Simulate → 3.6 Checklist → 3.7 Records.
3. **Epic 4 재번호**: 기존 4.2(SeasonBanner) 삭제, 4.3(광고·감사) → 4.2. 4.1의 `Depends on`을 3.2~3.7로 갱신.
4. **F3 실시간 슬라이더 시뮬레이션 소유 명시**: Task 3.5 DoD에 "슬라이더 변경마다 `calcTax` 재호출·히어로 반영" 요건을 명문화(리뷰 [GAP] F3 대응).
5. **AC 커버리지 유지**: 64/64, 누락 0. F8-AC3/AC4는 3.1로 이관.