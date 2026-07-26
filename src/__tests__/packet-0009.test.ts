import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { TaxProfile, Deductions } from "@/lib/types";
import * as calcModule from "@/lib/calc";

mockAll();

// Result.tsx는 아직 생성되지 않음 — TDD red phase 예상 동작
import Result from "@/pages/Result";

const EMPTY_DEDUCTIONS: Deductions = {
  creditCard: 0,
  medical: 0,
  education: 0,
  irp: 0,
  insurance: 0,
  donation: 0,
};

function makeProfile(overrides: Partial<TaxProfile> = {}): TaxProfile {
  return {
    id: "profile-1",
    taxYear: 2025,
    incomeType: "employee",
    annualSalary: 50000000,
    freelanceIncome: 0,
    dependents: 0,
    updatedAt: 1234567890,
    ...overrides,
  };
}

// annualSalary 50,000,000 + creditCard 공제 3,000,000(한도 클램프) 적용 시
// calcTax(계산 엔진 실값) 기준: taxableIncome=47,000,000 / calculatedTax=5,790,000 /
// prepaidTax=6,240,000 / refundAmount=450,000 (양수 = 환급)
function seedForRefund() {
  seedLocalStorage({
    "taxback:profile": makeProfile(),
    "taxback:deductions": { ...EMPTY_DEDUCTIONS, creditCard: 10000000 },
  });
}

function renderResult() {
  return renderWithRouter(React.createElement(Result));
}

describe("결과 페이지 (`/result`) + 종소세 판정", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-1[P0]: refund-hero SummaryHero 1개와 summary-card Card(ListRow 3개: 과세표준/산출세액/기납부세액)를 렌더한다", () => {
    seedForRefund();
    renderResult();

    expect(screen.getAllByTestId("refund-hero")).toHaveLength(1);
    expect(screen.getAllByTestId("summary-card")).toHaveLength(1);

    const summaryCard = screen.getByTestId("summary-card");
    expect(within(summaryCard).getAllByRole("listitem")).toHaveLength(3);
    expect(within(summaryCard).getByText("과세표준")).toBeInTheDocument();
    expect(within(summaryCard).getByText("산출세액")).toBeInTheDocument();
    expect(within(summaryCard).getByText("기납부세액")).toBeInTheDocument();
    // 계산 엔진 실값 기준 구체적 금액 검증
    expect(within(summaryCard).getByText("47,000,000원")).toBeInTheDocument();
    expect(within(summaryCard).getByText("5,790,000원")).toBeInTheDocument();
    expect(within(summaryCard).getByText("6,240,000원")).toBeInTheDocument();
  });

  it("AC-1[P0]: refundAmount는 refund-hero 안에서 t2 타이포로 강조된다", () => {
    seedForRefund();
    renderResult();

    const hero = screen.getByTestId("refund-hero");
    const t2Node = hero.querySelector('[data-typography="t2"]');
    expect(t2Node).not.toBeNull();
    expect(t2Node?.textContent).toBe("450,000원");
  });

  it("AC-2[P0]: refundAmount가 양수(450,000)면 '예상 환급 450,000원'을 CountUp으로 표시한다", () => {
    seedForRefund();
    renderResult();

    expect(screen.getByText(/예상 환급/)).toBeInTheDocument();
    expect(screen.getByText("450,000원")).toBeInTheDocument();
    expect(screen.queryByText("추가납부 예상")).toBeNull();
  });

  it("AC-2[P0]: refundAmount가 음수(-1,000,000)면 '추가납부 예상' 라벨로 전환되고 1,000,000원을 표시한다", () => {
    seedForRefund();
    vi.spyOn(calcModule, "calcTax").mockReturnValue({
      taxableIncome: 50000000,
      calculatedTax: 6000000,
      prepaidTax: 5000000,
      refundAmount: -1000000,
      breakdown: [],
      needsGlobalFiling: false,
      computedAt: 1234567890,
    });

    renderResult();

    expect(screen.getByText("추가납부 예상")).toBeInTheDocument();
    expect(screen.getByText("1,000,000원")).toBeInTheDocument();
    expect(screen.queryByText(/예상 환급/)).toBeNull();
  });

  it("AC-3[P1]: 소득이 0이면 EmptyState '소득을 먼저 입력해주세요'와 '입력하러 가기' 버튼(→ /)을 표시한다", () => {
    seedLocalStorage({
      "taxback:profile": makeProfile({ annualSalary: 0, freelanceIncome: 0 }),
      "taxback:deductions": EMPTY_DEDUCTIONS,
    });
    renderResult();

    expect(screen.getByText("소득을 먼저 입력해주세요")).toBeInTheDocument();
    expect(screen.queryByTestId("refund-hero")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "입력하러 가기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("AC-3[P1]: '기록 저장' 버튼 탭 시 saveRecord가 호출되고 Toast '올해 기록을 저장했어요'가 표시된다", () => {
    seedForRefund();
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "기록 저장" }));

    expect(screen.getByText("올해 기록을 저장했어요")).toBeInTheDocument();

    const records = JSON.parse(localStorage.getItem("taxback:records") ?? "[]");
    expect(records).toHaveLength(1);
    expect(records[0].taxYear).toBe(2025);
    expect(records[0].result.refundAmount).toBe(450000);
  });

  it("AC-3[P1]: 저장 공간이 부족하면(QuotaExceededError) '저장 공간이 부족해요' Toast를 표시한다", () => {
    seedForRefund();
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

    renderResult();
    fireEvent.click(screen.getByRole("button", { name: "기록 저장" }));

    expect(screen.getByText("저장 공간이 부족해요")).toBeInTheDocument();
    expect(screen.queryByText("올해 기록을 저장했어요")).toBeNull();

    setItemSpy.mockRestore();
  });

  it("AC-4[P1]: 결과 화면 하단에 참고용 추정 고지 문구를 항상 표시한다", () => {
    seedForRefund();
    renderResult();

    expect(
      screen.getByText("실제 신고 결과와 다를 수 있는 참고용 추정치입니다"),
    ).toBeInTheDocument();
  });
});
